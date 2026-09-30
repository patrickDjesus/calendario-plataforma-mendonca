/**
 * CloudSync — Persistencia no Supabase (fonte unica da verdade)
 *
 * Modelo: um snapshot por CHAVE DE SINCRONIZACAO na tabela `app_state`
 * (`user_id` = hash da chave, calculado em `syncKey.ts`). Como o id vem da
 * chave e nao de um UUID do navegador, a mesma chave em outro dispositivo abre
 * exatamente o mesmo banco.
 *
 * Nao existe copia local do banco: o que o app mostra veio do Supabase e cada
 * gravacao e esperada pela nuvem antes de contar como salva. Sem internet o
 * app nao abre — por design. Gravacao que falha entra numa fila de retentativa
 * e o status vira 'error' para a interface avisar em vez de fingir que salvou.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { DatabaseSchema } from '../types';

// `import.meta.env` existe quando o app e servido pelo Vite. A guarda permite
// que scripts de node (o smoke test de navegador) importem este modulo sem
// quebrar — no app a variable nunca fica indefinida.
const env: Record<string, string | undefined> =
  (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};

export const SUPABASE_URL = env.VITE_SUPABASE_URL ?? 'https://xiegypwxoovoijlkwcrb.supabase.co';
export const SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhpZWd5cHd4b292b2lqbGt3Y3JiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2MDE4NjQsImV4cCI6MjEwNjE3Nzg2NH0.6wSell1N-9AipHjqdkXrt3DmH3VwVzZ4IJp8KxjGIQs';

export type SyncStatus = 'offline' | 'syncing' | 'synced' | 'error';

export class SyncKeyRequiredError extends Error {
  constructor() {
    super('Nenhuma chave de sincronizacao definida');
    this.name = 'SyncKeyRequiredError';
  }
}

export class CloudUnavailableError extends Error {
  readonly cause?: unknown;
  constructor(cause?: unknown) {
    super('Supabase indisponivel');
    this.name = 'CloudUnavailableError';
    this.cause = cause;
  }
}

/**
 * A linha existe mas o que esta dentro dela nao e um banco utilizavel. Nao da
 * para consertar apagando: a linha pode ser a unica copia de alguma coisa. O
 * app precisa dizer isso em vez de quebrar ou — pior — abrir um banco vazio e
 * deixar o usuario achando que perdeu tudo.
 */
export class CloudDataCorruptedError extends Error {
  readonly userId: string;
  constructor(userId: string) {
    super('Conteudo do banco invalido');
    this.name = 'CloudDataCorruptedError';
    this.userId = userId;
  }
}

/** O minimo para o app ter o que mostrar. Sem isso, nao e um banco. */
export function isDatabaseShape(data: unknown): data is DatabaseSchema {
  if (!data || typeof data !== 'object') return false;
  const d = data as Partial<DatabaseSchema>;
  return !!d.profile && typeof d.profile === 'object' && Array.isArray(d.tasks);
}

export interface CloudRow {
  data: DatabaseSchema;
  rev: number;
  version: number;
}

class CloudSync {
  readonly client: SupabaseClient;
  private status: SyncStatus = 'offline';
  private listeners = new Set<(status: SyncStatus) => void>();
  private pushChain: Promise<void> = Promise.resolve();
  /** user_id em uso; sempre derivado da chave. */
  private userId: string | null = null;
  /** Rev confirmado pela ultima leitura/escrita real. */
  private rev = 0;
  /** Snapshot que falhou e ainda precisa ir para a nuvem. */
  private pending: DatabaseSchema | null = null;

  constructor() {
    this.client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  }

  getStatus(): SyncStatus {
    return this.status;
  }

  onChange(listener: (status: SyncStatus) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private setStatus(status: SyncStatus): void {
    if (this.status === status) return;
    this.status = status;
    this.listeners.forEach((l) => l(status));
  }

  /**
   * Define a identidade. Precisa da chave porque nao existe mais "dispositivo
   * anonimo": sem chave nao ha linha na nuvem para ler ou escrever.
   */
  setUser(userId: string): void {
    this.userId = userId;
  }

  getUser(): string | null {
    return this.userId;
  }

  /** Rev guardado em memoria, nunca em localStorage. */
  getRev(): number {
    return this.rev;
  }

  private requireUser(): string {
    if (!this.userId) throw new SyncKeyRequiredError();
    return this.userId;
  }

  /** Busca o snapshot da nuvem. `userId` distinto = leitura de outra linha. */
  async pull(userId?: string): Promise<CloudRow | null> {
    const target = userId ?? this.requireUser();
    // Ler a linha antiga (importacao) nao pode adotar o rev dela: o contador
    // precisa continuar referindo a linha da chave atual.
    const foreign = userId !== undefined && userId !== this.userId;
    const { data, error } = await this.client
      .from('app_state')
      .select('data, rev, version')
      .eq('user_id', target)
      .maybeSingle();
    if (error) throw new CloudUnavailableError(error);
    if (!data) return null;
    if (!foreign) this.rev = Number(data.rev) || 0;
    return {
      data: data.data as DatabaseSchema,
      rev: Number(data.rev) || 0,
      version: Number(data.version) || 0,
    };
  }

  /**
   * Envia o snapshot e so resolve quando a nuvem confirmar.
   *
   * Diferente da versao antiga, o erro NAO e engolido: quem chamou precisa
   * saber que nao salvou. Alem disso o snapshot fica na fila para retentativa
   * e o status vira 'error' para a interface avisar.
   */
  push(db: DatabaseSchema): Promise<void> {
    const job = this.pushChain.then(async () => {
      const target = this.requireUser();
      this.setStatus('syncing');
      const nextRev = this.rev + 1;
      const nowISO = new Date().toISOString();
      const todayDate = nowISO.split('T')[0];

      const { error } = await this.client.from('app_state').upsert(
        {
          user_id: target,
          data: db,
          rev: nextRev,
          version: db.version,
          updated_at: nowISO,
        },
        { onConflict: 'user_id' }
      );
      if (error) throw new CloudUnavailableError(error);
      this.rev = nextRev;
      this.pending = null;
      this.setStatus('synced');

      // Bloco A3: Backup diário automático no primeiro sync do dia
      this.maybeCreateDailyBackup(target, todayDate, db).catch(() => {});
    });
    this.pushChain = job.catch(() => {});
    return job.catch((err) => {
      this.pending = db;
      this.setStatus('error');
      throw err;
    });
  }

  /**
   * Tenta salvar backup diário na tabela app_state_backups se disponível
   */
  private async maybeCreateDailyBackup(userId: string, todayDate: string, db: DatabaseSchema): Promise<void> {
    const lastBackupKey = `lumina_last_daily_backup_${userId}`;
    const lastBackupDate = typeof localStorage !== 'undefined' ? localStorage.getItem(lastBackupKey) : null;
    if (lastBackupDate === todayDate) return;

    try {
      await this.client.from('app_state_backups').insert({
        user_id: userId,
        snapshot_date: todayDate,
        data: db,
        created_at: new Date().toISOString(),
      });
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(lastBackupKey, todayDate);
      }
    } catch {
      // Degradação elegante caso a tabela não tenha sido criada no Supabase ainda
    }
  }

  /** Busca lista de backups remotos se disponível */
  async fetchBackups(): Promise<Array<{ id: string; snapshot_date: string; created_at: string; data_size: number }>> {
    try {
      const target = this.requireUser();
      const { data, error } = await this.client
        .from('app_state_backups')
        .select('id, snapshot_date, created_at, data')
        .eq('user_id', target)
        .order('created_at', { ascending: false })
        .limit(30);
      if (error || !data) return [];
      return data.map((row: any) => ({
        id: row.id,
        snapshot_date: row.snapshot_date,
        created_at: row.created_at,
        data_size: JSON.stringify(row.data || {}).length,
      }));
    } catch {
      return [];
    }
  }

  /** Restaura backup específico da tabela de backups */
  async fetchBackupById(backupId: string): Promise<DatabaseSchema | null> {
    try {
      const { data, error } = await this.client
        .from('app_state_backups')
        .select('data')
        .eq('id', backupId)
        .maybeSingle();
      if (error || !data) return null;
      return data.data as DatabaseSchema;
    } catch {
      return null;
    }
  }

  // ==== BLOCO A7: SUPABASE AUTH ====
  async sendMagicLink(email: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.client.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
        },
      });
      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Falha ao enviar link mágico' };
    }
  }

  async signOut(): Promise<void> {
    try {
      await this.client.auth.signOut();
    } catch {}
  }

  async getAuthSessionUser(): Promise<{ id: string; email?: string } | null> {
    try {
      const { data } = await this.client.auth.getSession();
      if (data?.session?.user) {
        return {
          id: data.session.user.id,
          email: data.session.user.email,
        };
      }
      return null;
    } catch {
      return null;
    }
  }

  /** Reenvia o ultimo snapshot que falhou, se houver. */
  async retry(): Promise<boolean> {
    if (!this.pending) return false;
    const snapshot = this.pending;
    try {
      await this.push(snapshot);
      return true;
    } catch {
      return false;
    }
  }

  hasPending(): boolean {
    return this.pending !== null;
  }

  /**
   * Primeira carga: a nuvem decide. Se a linha nao existe ainda, `seed` vira o
   * banco inicial e e enviado.
   */
  async bootstrap(seed: DatabaseSchema): Promise<DatabaseSchema> {
    const cloud = await this.pull();
    if (cloud) {
      this.setStatus('synced');
      return cloud.data;
    }
    await this.push(seed);
    return seed;
  }
}

export const cloudSync = new CloudSync();
