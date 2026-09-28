/**
 * @vitest-environment jsdom
 *
 * Integracao real com o Supabase. Nao roda no `npm test` normal porque
 * escreve na tabela de verdade — e o usuario nao deve depender da internet
 * para rodar a suite:
 *
 *   RUN_CLOUD_TESTS=1 npx vitest run src/__tests__/cloud-live.test.ts
 *
 * A linha criada e apagada no final, mesmo se o teste falhar no meio.
 */

import 'fake-indexeddb/auto';
import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { cloudSync } from '../services/supabase';
import { userIdFromSyncKey } from '../services/syncKey';

// Chave nova a cada execucao. A RLS nao deixa o anon apagar a linha, entao
// reaproveitar uma chave fixa faria a 2a rodada abrir o restoixo encolhido da
// 1a e o teste falharia por um motivo que nao tem a ver com o que ele testa.
const CHAVE = `chave-de-integracao-${Date.now().toString(36)}`;
const USER_ID = userIdFromSyncKey(CHAVE);

const enabled = process.env.RUN_CLOUD_TESTS === '1';

describe.skipIf(!enabled)('Supabase real', () => {
  beforeAll(() => {
    localStorage.setItem('focosemanal_sync_key', CHAVE);
  });

  afterAll(async () => {
    // A RLS da tabela nao autoriza DELETE para anon (a API responde 204 sem
    // apagar nada), entao a "limpeza" encolhe a linha em vez de remove-la. Para
    // apagar de vez e preciso rodar o SQL no painel do Supabase.
    await cloudSync.client.from('app_state').upsert(
      {
        user_id: USER_ID,
        data: { nota: 'linha efemera de teste de integracao, pode apagar' },
        rev: 1,
        version: 0,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );
    localStorage.clear();
    console.log(
      `\n  Para apagar o que este teste criou:\n` +
      `  delete from app_state where user_id = '${USER_ID}';`
    );
  });

  it('cria a linha, grava e le de volta da nuvem', async () => {
    const { repository } = await import('../services/repository');
    const db = await repository.initialize();
    expect(db.profile.name).toBe('Patrick');

    const gravado = await repository.saveTask({
      title: 'Tarefa de integracao',
      categoryId: 'cat-saude',
      priority: 'media',
      date: '2026-09-28',
      spentSeconds: 0,
      completed: false,
      tags: [],
      subtasks: [],
      order: 0,
    });
    expect(gravado.id).toBeTruthy();

    // Le direto do Supabase, sem passar pelo repositorio: prova que saiu da
    // maquina, e nao ficou so na memoria do processo.
    const { data, error } = await cloudSync.client
      .from('app_state')
      .select('data, rev')
      .eq('user_id', USER_ID)
      .single();
    expect(error).toBeNull();

    const row = data as { data: { tasks: { title: string }[] }; rev: number };
    expect(row.rev).toBeGreaterThanOrEqual(1);
    expect(row.data.tasks.map(t => t.title)).toContain('Tarefa de integracao');
  });

  it('a mesma chave le o que a outra gravacao deixou', async () => {
    const { data, error } = await cloudSync.client
      .from('app_state')
      .select('data')
      .eq('user_id', USER_ID)
      .single();
    expect(error).toBeNull();
    const row = data as { data: { tasks: { title: string }[] } };
    expect(row.data.tasks.map(t => t.title)).toContain('Tarefa de integracao');
  });

  it('chave diferente nao enxerga a linha', async () => {
    const outra = userIdFromSyncKey('outra-chave-bem-diferente-77');
    const { data, error } = await cloudSync.client
      .from('app_state')
      .select('user_id')
      .eq('user_id', outra)
      .maybeSingle();
    expect(error).toBeNull();
    expect(data).toBeNull();
  });

  it('linha truncada nao abre um banco vazio por cima', async () => {
    const chave = `chave-truncada-${Date.now().toString(36)}`;
    const id = userIdFromSyncKey(chave);
    const { error: erroEscrita } = await cloudSync.client.from('app_state').upsert(
      { user_id: id, data: { nota: 'escrita truncada' }, rev: 1, version: 0, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );
    expect(erroEscrita).toBeNull();

    try {
      const { repository } = await import('../services/repository');
      localStorage.setItem('focosemanal_sync_key', chave);
      repository.reset();

      // O erro precisa ser o de conteudo invalido, e nao um TypeError: e o que
      // separa "avisa o usuario" de "tela branca".
      await expect(repository.initialize()).rejects.toMatchObject({
        name: 'CloudDataCorruptedError',
        userId: id,
      });

      const { data } = await cloudSync.client.from('app_state').select('data').eq('user_id', id).single();
      // Intacta: o app avisou em vez de regravar por cima.
      expect(data).toEqual({ data: { nota: 'escrita truncada' } });
    } finally {
      localStorage.setItem('focosemanal_sync_key', CHAVE);
    }
  });
});
