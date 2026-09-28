/**
 * @vitest-environment jsdom
 *
 * Carga e gravacao com a nuvem como fonte unica. O Supabase e substituido por
 * uma tabela em memoria: o que interessa aqui e a regra (a nuvem decide o que
 * aparece, nada e aceito como salvo sem confirmacao, a carga falha em vez de
 * inventar banco), nao o HTTP.
 */

import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createInitialDatabase } from '../services/repository';
import { STORAGE_KEY_V5, IDB_NAME } from '../constants/app';
import type { DatabaseSchema, Task } from '../types';

const { fakeCloud, SyncKeyRequiredError, CloudUnavailableError, CloudDataCorruptedError } = vi.hoisted(() => {
  class SyncKeyRequiredError extends Error {
    constructor() { super('Nenhuma chave de sincronizacao definida'); this.name = 'SyncKeyRequiredError'; }
  }
  class CloudUnavailableError extends Error {
    constructor(cause?: unknown) { super('Supabase indisponivel'); this.name = 'CloudUnavailableError'; void cause; }
  }
  class CloudDataCorruptedError extends Error {
    userId: string;
    constructor(userId: string) { super('Conteudo do banco invalido'); this.name = 'CloudDataCorruptedError'; this.userId = userId; }
  }

  class FakeCloud {
    rows = new Map<string, { data: DatabaseSchema; rev: number; version: number }>();
    userId: string | null = null;
    rev = 0;
    status = 'synced';
    pending: DatabaseSchema | null = null;
    falharProximoPush = false;
    pushes = 0;
    private listeners = new Set<(s: string) => void>();

    reset() {
      this.rows.clear();
      this.userId = null;
      this.rev = 0;
      this.status = 'synced';
      this.pending = null;
      this.falharProximoPush = false;
      this.pushes = 0;
    }
    getStatus() { return this.status; }
    getUser() { return this.userId; }
    getRev() { return this.rev; }
    hasPending() { return this.pending !== null; }
    onChange(l: (s: string) => void) { this.listeners.add(l); return () => { this.listeners.delete(l); }; }
    setUser(id: string) { this.userId = id; }
    private setStatus(s: string) {
      if (this.status === s) return;
      this.status = s;
      this.listeners.forEach(l => l(s));
    }
    async pull(userId?: string) {
      const target = userId ?? this.userId;
      if (!target) throw new SyncKeyRequiredError();
      const row = this.rows.get(target);
      if (!row) return null;
      if (userId === undefined || userId === this.userId) this.rev = row.rev;
      // Clona como o HTTP faz: um objeto novo, desconectado do que esta guardado.
      return { data: structuredClone(row.data), rev: row.rev, version: row.version };
    }
    async push(db: DatabaseSchema) {
      if (!this.userId) throw new SyncKeyRequiredError();
      if (this.falharProximoPush) {
        this.falharProximoPush = false;
        this.pending = db;
        this.setStatus('error');
        throw new CloudUnavailableError('rede fora');
      }
      this.pushes += 1;
      const nextRev = (this.rows.get(this.userId)?.rev ?? 0) + 1;
      this.rows.set(this.userId, { data: structuredClone(db), rev: nextRev, version: db.version });
      this.rev = nextRev;
      this.pending = null;
      this.setStatus('synced');
    }
    async retry() {
      if (!this.pending) return false;
      const snap = this.pending;
      try { await this.push(snap); return true; } catch { return false; }
    }
  }

  return { fakeCloud: new FakeCloud(), SyncKeyRequiredError, CloudUnavailableError, CloudDataCorruptedError };
});

// Mesmas classes que o falso lanca: assim o instanceof do codigo tambem vale.
vi.mock('../services/supabase', () => ({
  cloudSync: fakeCloud,
  SyncKeyRequiredError,
  CloudUnavailableError,
  CloudDataCorruptedError,
  isDatabaseShape: (d: unknown) =>
    !!d && typeof d === 'object' && !!(d as { profile?: unknown }).profile && Array.isArray((d as { tasks?: unknown }).tasks),
}));

const KEY = 'minha-chave-de-teste';

let repository: typeof import('../services/repository').repository;
let syncKey: typeof import('../services/syncKey');

const tarefa = (over: Partial<Task> = {}): Task => ({
  id: 't-1',
  title: 'Caminhada',
  categoryId: 'cat-saude',
  priority: 'media',
  date: '2026-09-28',
  spentSeconds: 0,
  completed: false,
  tags: [],
  subtasks: [],
  order: 0,
  createdAt: '2026-09-28T10:00:00Z',
  updatedAt: '2026-09-28T10:00:00Z',
  ...over,
});

/** Escreve a copia local antiga direto no IndexedDB, como a versao anterior fazia. */
async function gravarEspelhoLocalAntigo(data: DatabaseSchema | null): Promise<void> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 2);
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains('app_state')) d.createObjectStore('app_state');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('app_state', 'readwrite');
    const store = tx.objectStore('app_state');
    if (data === null) store.delete('current');
    else store.put(data, 'current');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

beforeEach(async () => {
  localStorage.clear();
  fakeCloud.reset();
  vi.resetModules();
  await gravarEspelhoLocalAntigo(null);
  syncKey = await import('../services/syncKey');
  const mod = await import('../services/repository');
  repository = mod.repository;
});

afterEach(async () => {
  await gravarEspelhoLocalAntigo(null);
});

describe('carga sem chave', () => {
  it('recusa em vez de inventar um banco', async () => {
    await expect(repository.initialize()).rejects.toMatchObject({ name: 'SyncKeyRequiredError' });
    expect(fakeCloud.rows.size).toBe(0);
  });
});

describe('primeira carga', () => {
  it('cria a linha nova e envia o banco inicial para a nuvem', async () => {
    syncKey.setSyncKey(KEY);
    const db = await repository.initialize();

    expect(db.profile.name).toBe('Patrick');
    const linha = fakeCloud.rows.get(syncKey.userIdFromSyncKey(KEY));
    expect(linha).toBeDefined();
    expect(linha!.data.profile.name).toBe('Patrick');
    expect(fakeCloud.pushes).toBe(1);
  });

  it('a mesma chave em outro dispositivo cai na MESMA linha', async () => {
    syncKey.setSyncKey(KEY);
    await repository.initialize();

    const id = syncKey.userIdFromSyncKey(KEY);
    expect(id).toBe(syncKey.userIdFromSyncKey('  MINHA-CHAVE-DE-TESTE  '));
    expect(id.startsWith('pat-')).toBe(true);
    expect(fakeCloud.rows.get(id)).toBeDefined();
  });

  it('chave diferente nao enxerga a linha anterior', async () => {
    syncKey.setSyncKey(KEY);
    await repository.initialize();
    const outra = await syncKey.userIdFromSyncKey('outra-chave-totalmente');
    expect(fakeCloud.rows.get(outra)).toBeUndefined();
  });
});

describe('carga com a nuvem disponivel', () => {
  it('a nuvem manda: o que vem de la aparece, e nada e reenviado', async () => {
    const id = syncKey.userIdFromSyncKey(KEY);
    const remoto = createInitialDatabase();
    remoto.profile.name = 'Patrick do outro dispositivo';
    remoto.tasks.push(tarefa({ title: 'Tarefa que so existe na nuvem' }));
    fakeCloud.rows.set(id, { data: remoto, rev: 7, version: remoto.version });

    syncKey.setSyncKey(KEY);
    const db = await repository.initialize();

    expect(db.profile.name).toBe('Patrick do outro dispositivo');
    expect(db.tasks.map(t => t.title)).toContain('Tarefa que so existe na nuvem');
    // Snapshot novo e identico ao da nuvem: nao ha por que reescrever.
    expect(fakeCloud.pushes).toBe(0);
    expect(fakeCloud.getRev()).toBe(7);
  });

  it('aplica migracao no dado vindo da nuvem e devolve a versao corrigida', async () => {
    const id = syncKey.userIdFromSyncKey(KEY);
    const remoto = createInitialDatabase();
    remoto.profile.name = 'Estudante';
    (remoto.categories as { name: string }[])[0].name = 'Saúde & Treino';
    fakeCloud.rows.set(id, { data: remoto, rev: 3, version: remoto.version });

    syncKey.setSyncKey(KEY);
    const db = await repository.initialize();

    expect(db.profile.name).toBe('Patrick');
    expect(fakeCloud.pushes).toBe(1);
    const gravado = fakeCloud.rows.get(id)!.data;
    expect(gravado.profile.name).toBe('Patrick');
  });

  it('linha com conteudo incompleto da erro claro em vez de quebrar', async () => {
    const id = syncKey.userIdFromSyncKey(KEY);
    // O que acontece com uma escrita truncada na nuvem.
    fakeCloud.rows.set(id, { data: { nota: 'linha truncada' } as unknown as DatabaseSchema, rev: 1, version: 0 });

    syncKey.setSyncKey(KEY);
    await expect(repository.initialize()).rejects.toMatchObject({
      name: 'CloudDataCorruptedError',
      userId: id,
    });
    // O que esta na nuvem fica intacto: o app nao tenta consertar por cima.
    expect(fakeCloud.rows.get(id)!.data).toEqual({ nota: 'linha truncada' } as unknown as DatabaseSchema);
    expect(fakeCloud.pushes).toBe(0);
  });

  it('linha incompleta nao vira banco vazio silencioso', async () => {
    const id = syncKey.userIdFromSyncKey(KEY);
    fakeCloud.rows.set(id, { data: { tasks: [] } as unknown as DatabaseSchema, rev: 1, version: 0 });

    syncKey.setSyncKey(KEY);
    await expect(repository.initialize()).rejects.toBeTruthy();
    expect(fakeCloud.rows.get(id)!.data).toEqual({ tasks: [] } as unknown as DatabaseSchema);
  });
});

describe('importacao unica do que ja existia', () => {
  it('traz a linha antiga por dispositivo quando a chave ainda nao tem nada', async () => {
    const antigo = 'uuid-do-dispositivo-antigo';
    const legado = createInitialDatabase();
    legado.tasks.push(tarefa({ title: 'Tarefa antiga da nuvem' }));
    fakeCloud.rows.set(antigo, { data: legado, rev: 12, version: legado.version });
    localStorage.setItem('focosemanal_device_id', antigo);

    syncKey.setSyncKey(KEY);
    const db = await repository.initialize();

    expect(db.tasks.map(t => t.title)).toContain('Tarefa antiga da nuvem');
    const id = syncKey.userIdFromSyncKey(KEY);
    expect(fakeCloud.rows.get(id)!.data.tasks.map(t => t.title)).toContain('Tarefa antiga da nuvem');
  });

  it('nunca sobrescreve a linha da chave por causa da importacao', async () => {
    const id = syncKey.userIdFromSyncKey(KEY);
    const meu = createInitialDatabase();
    meu.tasks.push(tarefa({ title: 'Meu dado de verdade' }));
    fakeCloud.rows.set(id, { data: meu, rev: 4, version: meu.version });
    fakeCloud.rows.set('uuid-antigo', { data: createInitialDatabase(), rev: 99, version: meu.version });
    localStorage.setItem('focosemanal_device_id', 'uuid-antigo');

    syncKey.setSyncKey(KEY);
    const db = await repository.initialize();

    expect(db.tasks.map(t => t.title)).toContain('Meu dado de verdade');
    expect(fakeCloud.pushes).toBe(0);
  });

  it('limpa a copia local antiga so depois que a nuvem confirmou', async () => {
    const legado = createInitialDatabase();
    legado.tasks.push(tarefa({ title: 'Veio do espelho local' }));
    localStorage.setItem(STORAGE_KEY_V5, JSON.stringify(legado));

    syncKey.setSyncKey(KEY);
    const db = await repository.initialize();

    expect(db.tasks.map(t => t.title)).toContain('Veio do espelho local');
    expect(localStorage.getItem(STORAGE_KEY_V5)).toBeNull();
  });

  it('se a nuvem falhar, a copia local NAO e apagada', async () => {
    const legado = createInitialDatabase();
    localStorage.setItem(STORAGE_KEY_V5, JSON.stringify(legado));
    fakeCloud.falharProximoPush = true;

    syncKey.setSyncKey(KEY);
    await expect(repository.initialize()).rejects.toMatchObject({ name: 'CloudUnavailableError' });
    expect(localStorage.getItem(STORAGE_KEY_V5)).not.toBeNull();
  });

  it('se a nuvem falhar, o espelho local no IndexedDB tambem NAO e apagado', async () => {
    const legado = createInitialDatabase();
    legado.tasks.push(tarefa({ title: 'Espelho que nao pode sumir' }));
    await gravarEspelhoLocalAntigo(legado);
    fakeCloud.falharProximoPush = true;

    syncKey.setSyncKey(KEY);
    await expect(repository.initialize()).rejects.toMatchObject({ name: 'CloudUnavailableError' });

    const { idbManager } = await import('../services/db');
    const sobrou = await idbManager.loadLegacyState();
    expect(sobrou?.tasks.map(t => t.title)).toContain('Espelho que nao pode sumir');
  });

  it('apaga o espelho local do IndexedDB depois que a nuvem confirmou', async () => {
    const legado = createInitialDatabase();
    legado.tasks.push(tarefa({ title: 'Veio do IndexedDB' }));
    await gravarEspelhoLocalAntigo(legado);

    syncKey.setSyncKey(KEY);
    const db = await repository.initialize();

    expect(db.tasks.map(t => t.title)).toContain('Veio do IndexedDB');
    const { idbManager } = await import('../services/db');
    expect(await idbManager.loadLegacyState()).toBeNull();
  });
});

/**
 * A versao antiga engolia o erro do push, entao a copia local pode estar a
 * FRENTE da nuvem. A importacao nao pode ser uma aposta em qual delas e a boa.
 */
describe('escolha de qual copia antiga continua', () => {
  const ANTIGO = '2026-09-20T10:00:00Z';
  const RECENTE = '2026-09-27T18:00:00Z';

  // Datas fixas em vez de "hoje": o teste nao pode depender do relogio.
  const comAtividade = (tasks: Task[], lastActiveDate: string): DatabaseSchema => {
    const db = createInitialDatabase();
    db.profile.lastActiveDate = lastActiveDate;
    db.tasks = tasks;
    return db;
  };

  it('copia local mais nova vence a nuvem (push antigo que nunca chegou)', async () => {
    const nuvem = comAtividade(
      [tarefa({ title: 'So na nuvem', updatedAt: ANTIGO, createdAt: ANTIGO })],
      '2026-09-20'
    );
    fakeCloud.rows.set('uuid-antigo', { data: nuvem, rev: 9, version: nuvem.version });

    const local = comAtividade(
      [tarefa({ title: 'So no navegador', updatedAt: RECENTE, createdAt: RECENTE })],
      '2026-09-27'
    );
    await gravarEspelhoLocalAntigo(local);
    localStorage.setItem('focosemanal_device_id', 'uuid-antigo');

    syncKey.setSyncKey(KEY);
    const db = await repository.initialize();

    expect(db.tasks.map(t => t.title)).toContain('So no navegador');
  });

  it('nuvem mais nova vence a copia local', async () => {
    const nuvem = comAtividade(
      [tarefa({ title: 'So na nuvem', updatedAt: RECENTE, createdAt: RECENTE })],
      '2026-09-27'
    );
    fakeCloud.rows.set('uuid-antigo', { data: nuvem, rev: 30, version: nuvem.version });

    const local = comAtividade(
      [tarefa({ title: 'So no navegador', updatedAt: ANTIGO, createdAt: ANTIGO })],
      '2026-09-20'
    );
    await gravarEspelhoLocalAntigo(local);
    localStorage.setItem('focosemanal_device_id', 'uuid-antigo');

    syncKey.setSyncKey(KEY);
    const db = await repository.initialize();

    expect(db.tasks.map(t => t.title)).toContain('So na nuvem');
    expect(db.tasks.map(t => t.title)).not.toContain('So no navegador');
  });

  it('empate nao custa tarefa: vence a copia com mais conteudo', async () => {
    const nuvem = comAtividade(
      [
        tarefa({ id: 'a', title: 'A', updatedAt: ANTIGO, createdAt: ANTIGO }),
        tarefa({ id: 'b', title: 'B', updatedAt: ANTIGO, createdAt: ANTIGO }),
      ],
      '2026-09-20'
    );
    fakeCloud.rows.set('uuid-antigo', { data: nuvem, rev: 9, version: nuvem.version });

    const local = comAtividade(
      [tarefa({ id: 'a', title: 'A', updatedAt: ANTIGO, createdAt: ANTIGO })],
      '2026-09-20'
    );
    await gravarEspelhoLocalAntigo(local);
    localStorage.setItem('focosemanal_device_id', 'uuid-antigo');

    syncKey.setSyncKey(KEY);
    const db = await repository.initialize();

    expect(db.tasks.map(t => t.title).sort()).toEqual(['A', 'B']);
  });

  it('empate total fica com a nuvem, que e a copia que se sabe que chegou', async () => {
    const nuvem = comAtividade(
      [tarefa({ id: 'a', title: 'Na nuvem', updatedAt: ANTIGO, createdAt: ANTIGO })],
      '2026-09-20'
    );
    fakeCloud.rows.set('uuid-antigo', { data: nuvem, rev: 9, version: nuvem.version });

    const local = comAtividade(
      [tarefa({ id: 'a', title: 'No navegador', updatedAt: ANTIGO, createdAt: ANTIGO })],
      '2026-09-20'
    );
    await gravarEspelhoLocalAntigo(local);
    localStorage.setItem('focosemanal_device_id', 'uuid-antigo');

    syncKey.setSyncKey(KEY);
    const db = await repository.initialize();

    expect(db.tasks.map(t => t.title)).toEqual(['Na nuvem']);
  });

  it('lixada e lida: o que foi para o lixo nao volta como tarefa ativa', async () => {
    const local = createInitialDatabase();
    const apagada = tarefa({ id: 'x', title: 'Apagada', updatedAt: RECENTE, createdAt: RECENTE });
    local.trash = [{ ...apagada, originalDeletedAt: RECENTE }];
    await gravarEspelhoLocalAntigo(local);

    syncKey.setSyncKey(KEY);
    const db = await repository.initialize();

    expect(db.tasks.map(t => t.title)).not.toContain('Apagada');
    expect((await repository.getTrash()).map(t => t.title)).toContain('Apagada');
  });
});

/**
 * Regressoes que já tiveram cobertura e não podem voltar a sumir junto com a
 * reescrita para a nuvem.
 */
describe('de onde veio o banco aberto', () => {
  it('avisa que nasceu do zero quando nao havia linha nem copia antiga', async () => {
    syncKey.setSyncKey(KEY);
    await repository.initialize();
    expect(repository.getBootOrigin()).toBe('criado-do-zero');
  });

  it('diz que veio da nuvem, e nao do zero', async () => {
    const id = syncKey.userIdFromSyncKey(KEY);
    fakeCloud.rows.set(id, { data: createInitialDatabase(), rev: 5, version: 5 });

    syncKey.setSyncKey(KEY);
    await repository.initialize();

    expect(repository.getBootOrigin()).toBe('da-nuvem');
  });

  it('diz que importou quando recuperou dado de antes', async () => {
    const legado = createInitialDatabase();
    legado.tasks.push(tarefa({ title: 'Do espelho' }));
    localStorage.setItem(STORAGE_KEY_V5, JSON.stringify(legado));

    syncKey.setSyncKey(KEY);
    await repository.initialize();

    expect(repository.getBootOrigin()).toBe('importado');
  });

  it('reset limpa a origem, para a proxima carga responder de novo', async () => {
    syncKey.setSyncKey(KEY);
    await repository.initialize();
    repository.reset();
    expect(repository.getBootOrigin()).toBe('nenhuma');
  });
});

describe('regras que atravessam a gravacao na nuvem', () => {
  it('"choveu" sobrevive ao round-trip pela nuvem', async () => {
    syncKey.setSyncKey(KEY);
    await repository.initialize();

    const t = await repository.saveTask(tarefa({ blockedByRain: true }));
    expect(t.blockedByRain).toBe(true);

    // Relê do outro lado: o que a UI mostra tem de ser o que a nuvem guardou.
    const gravado = fakeCloud.rows.get(syncKey.userIdFromSyncKey(KEY))!.data;
    expect(gravado.tasks.find(x => x.id === t.id)?.blockedByRain).toBe(true);
  });

  it('reagendar a tarefa descarta a marca de chuva do dia anterior', async () => {
    syncKey.setSyncKey(KEY);
    await repository.initialize();

    const t = await repository.saveTask(tarefa({ date: '2026-09-28', blockedByRain: true }));
    const movida = await repository.saveTask({ ...t, date: '2026-09-29' });

    expect(movida.date).toBe('2026-09-29');
    expect(movida.blockedByRain).toBe(false);
  });

  it('reagendar em lote tambem descarta a marca de chuva', async () => {
    syncKey.setSyncKey(KEY);
    await repository.initialize();

    const t = await repository.saveTask(tarefa({ date: '2026-09-28', blockedByRain: true }));
    await repository.saveTasksBatch([{ ...t, date: '2026-09-30' }]);

    const gravado = fakeCloud.rows.get(syncKey.userIdFromSyncKey(KEY))!.data;
    expect(gravado.tasks.find(x => x.id === t.id)?.blockedByRain).toBe(false);
  });

  it('a categoria de saude perde o "& Treino" e o push leva a versao nova', async () => {
    const id = syncKey.userIdFromSyncKey(KEY);
    const remoto = createInitialDatabase();
    const catSaude = remoto.categories.find(c => c.id === 'cat-saude')!;
    catSaude.name = 'Saúde & Treino';
    remoto.tasks.push(tarefa({ categoryId: 'cat-saude' }));
    fakeCloud.rows.set(id, { data: remoto, rev: 2, version: remoto.version });

    syncKey.setSyncKey(KEY);
    const db = await repository.initialize();

    expect(db.categories.find(c => c.id === 'cat-saude')?.name).toBe('Saúde');
    expect(fakeCloud.rows.get(id)!.data.categories.find(c => c.id === 'cat-saude')?.name).toBe('Saúde');
  });

  it('categoria criada pelo usuario com o mesmo nome antigo nao e renomeada', async () => {
    const id = syncKey.userIdFromSyncKey(KEY);
    const remoto = createInitialDatabase();
    remoto.categories.push({ id: 'cat-minha', name: 'Saúde & Treino', color: '#fff', icon: 'heart' });
    fakeCloud.rows.set(id, { data: remoto, rev: 2, version: remoto.version });

    syncKey.setSyncKey(KEY);
    const db = await repository.initialize();

    expect(db.categories.find(c => c.id === 'cat-minha')?.name).toBe('Saúde & Treino');
    expect(db.categories.find(c => c.id === 'cat-saude')?.name).toBe('Saúde');
  });

  it('o app nao deixa nenhum snapshot do banco no IndexedDB', async () => {
    syncKey.setSyncKey(KEY);
    await repository.initialize();
    await repository.saveTask(tarefa());
    await repository.saveTask(tarefa({ id: 't-2', title: 'Outra' }));

    // Nenhuma store de backup: e ela que guardava a copia diaria do banco.
    const dbs = await indexedDB.databases();
    const nossa = dbs.find(d => d.name === IDB_NAME);
    expect(nossa?.version).toBe(2);

    const { idbManager } = await import('../services/db');
    expect(await idbManager.loadLegacyState()).toBeNull();
  });
});

describe('gravacao', () => {
  it('cada gravacao vai para a nuvem com rev crescente', async () => {
    syncKey.setSyncKey(KEY);
    await repository.initialize();
    const rev0 = fakeCloud.getRev();

    const t = await repository.saveTask(tarefa());
    const rev1 = fakeCloud.getRev();
    await repository.saveTask({ ...t, title: 'Corrida' });
    const rev2 = fakeCloud.getRev();

    expect(rev1).toBe(rev0 + 1);
    expect(rev2).toBe(rev1 + 1);
    expect(fakeCloud.rows.get(syncKey.userIdFromSyncKey(KEY))!.data.tasks[0].title).toBe('Corrida');
  });

  it('nao grava nada no navegador: nem localStorage nem espelho', async () => {
    syncKey.setSyncKey(KEY);
    await repository.initialize();
    await repository.saveTask(tarefa());

    expect(localStorage.getItem(STORAGE_KEY_V5)).toBeNull();
    expect(localStorage.getItem('focosemanal_clean_db_v3')).toBeNull();
    // O IndexedDB nao recebe mais o snapshot do dia.
    const { idbManager } = await import('../services/db');
    expect(await idbManager.loadLegacyState()).toBeNull();
  });

  it('falha de rede nao mente: o status vira error e fica pendente', async () => {
    syncKey.setSyncKey(KEY);
    await repository.initialize();
    fakeCloud.falharProximoPush = true;

    await repository.saveTask(tarefa());

    expect(fakeCloud.getStatus()).toBe('error');
    expect(fakeCloud.hasPending()).toBe(true);
    expect(repository.getLastSaveError()).toBeTruthy();
  });

  it('a retentativa entrega o que ficou pendente', async () => {
    syncKey.setSyncKey(KEY);
    await repository.initialize();
    fakeCloud.falharProximoPush = true;
    await repository.saveTask(tarefa({ title: 'Pendente' }));
    expect(fakeCloud.hasPending()).toBe(true);

    const ok = await repository.retryPendingSave();

    expect(ok).toBe(true);
    expect(fakeCloud.getStatus()).toBe('synced');
    expect(repository.getLastSaveError()).toBe(null);
    const id = syncKey.userIdFromSyncKey(KEY);
    expect(fakeCloud.rows.get(id)!.data.tasks[0].title).toBe('Pendente');
  });

  it('a UI continua funcionando mesmo com a nuvem fora (dado em memoria)', async () => {
    syncKey.setSyncKey(KEY);
    await repository.initialize();
    fakeCloud.falharProximoPush = true;

    const t = await repository.saveTask(tarefa({ title: 'Salva na memoria' }));

    expect(t.title).toBe('Salva na memoria');
    expect((await repository.getTasks()).map(x => x.title)).toContain('Salva na memoria');
  });
});

describe('reset e retentativa de carga', () => {
  it('reset permite tentar a carga de novo depois de uma falha', async () => {
    fakeCloud.falharProximoPush = true;
    syncKey.setSyncKey(KEY);
    await expect(repository.initialize()).rejects.toMatchObject({ name: 'CloudUnavailableError' });

    repository.reset();
    const db = await repository.initialize();

    expect(db.profile.name).toBe('Patrick');
  });

  it('trocar a chave aponta para outro banco', async () => {
    syncKey.setSyncKey(KEY);
    await repository.initialize();
    await repository.saveTask(tarefa({ title: 'Da chave A' }));

    syncKey.setSyncKey('segunda-chave-boa');
    repository.reset();
    const outro = await repository.initialize();

    expect(outro.tasks).toHaveLength(0);
  });
});
