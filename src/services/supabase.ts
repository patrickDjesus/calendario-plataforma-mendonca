/**
 * CloudSync — Persistencia em nuvem via Supabase
 *
 * Modelo: snapshot unico por dispositivo na tabela `app_state`
 * (user_id = UUID persistido em localStorage). Reconciliacao last-write-wins
 * por `rev` monotonicamente crescente. Toda gravacao local e empurrada em
 * background (debounced no repository); se a nuvem estiver indisponivel o
 * app continua 100% local e tenta de novo na proxima escrita.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { DatabaseSchema } from '../types';

export const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? 'https://xiegypwxoovoijlkwcrb.supabase.co';
export const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhpZWd5cHd4b292b2lqbGt3Y3JiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2MDE4NjQsImV4cCI6MjEwNjE3Nzg2NH0.6wSell1N-9AipHjqdkXrt3DmH3VwVzZ4IJp8KxjGIQs';

const DEVICE_ID_KEY = 'focosemanal_device_id';
const CLOUD_REV_KEY = 'focosemanal_cloud_rev';

export type SyncStatus = 'offline' | 'syncing' | 'synced' | 'error';

function getStorage(): Storage | null {
  return typeof localStorage !== 'undefined' ? localStorage : null;
}

export function getDeviceId(): string {
  const storage = getStorage();
  if (storage) {
    const existing = storage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;
  }
  const id =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : 'dev-' + Math.random().toString(36).substring(2, 11) + '-' + Date.now().toString(36);
  storage?.setItem(DEVICE_ID_KEY, id);
  return id;
}

export function getLocalRev(): number {
  const raw = getStorage()?.getItem(CLOUD_REV_KEY);
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function setLocalRev(rev: number): void {
  getStorage()?.setItem(CLOUD_REV_KEY, String(rev));
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

  /** Busca o snapshot da nuvem deste dispositivo. null se ainda nao existir. */
  async pull(): Promise<CloudRow | null> {
    const { data, error } = await this.client
      .from('app_state')
      .select('data, rev, version')
      .eq('user_id', getDeviceId())
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return { data: (data as { data: DatabaseSchema }).data, rev: Number((data as { rev: number }).rev), version: Number((data as { version: number }).version) };
  }

  /** Envia o snapshot (rev = local+1), serializado para evitar corridas. */
  push(db: DatabaseSchema): Promise<void> {
    const job = this.pushChain.then(async () => {
      this.setStatus('syncing');
      const rev = getLocalRev() + 1;
      const { error } = await this.client.from('app_state').upsert(
        {
          user_id: getDeviceId(),
          data: db,
          rev,
          version: db.version,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );
      if (error) throw error;
      setLocalRev(rev);
      this.setStatus('synced');
    });
    this.pushChain = job.catch(() => {});
    return job.catch(() => {
      this.setStatus('offline');
    });
  }

  /** Reconciliacao inicial: cloud mais nova vence, senao empurra o local. */
  async reconcile(db: DatabaseSchema): Promise<DatabaseSchema> {
    this.setStatus('syncing');
    try {
      const cloud = await this.pull();
      if (!cloud) {
        await this.push(db);
        return db;
      }
      if (cloud.rev > getLocalRev()) {
        setLocalRev(cloud.rev);
        this.setStatus('synced');
        return cloud.data;
      }
      await this.push(db);
      return db;
    } catch (e) {
      console.warn('CloudSync reconcile indisponível, seguindo local-only:', e);
      this.setStatus('offline');
      return db;
    }
  }
}

export const cloudSync = new CloudSync();