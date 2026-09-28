/**
 * Smoke test de navegador de verdade (nao e do `npm test`).
 *
 * Sobe o app, digita a chave, e percorre o caminho que eu reescrevi: gate ->
 * carga na nuvem -> app pronto -> criar tarefa -> conferir no Supabase ->
 * recarregar a pagina e ver o dado voltar. E o unico jeito de provar que nao
 * ha erro de runtime, ja que build e tsc nao executam React no browser.
 *
 *   PLAYWRIGHT_BROWSERS_PATH=/tmp/opencode/pw npx tsx scripts/smoke-navegador.ts
 */

import { chromium } from 'playwright-core';
import { cloudSync } from '../src/services/supabase';
import { userIdFromSyncKey } from '../src/services/syncKey';

const BASE = process.env.SMOKE_URL ?? 'http://localhost:3000';
// Chave unica por execucao: a RLS nao deixa o anon apagar a linha, entao uma
// chave fixa faria a rodada seguinte abrir o banco encolhido da anterior e o
// teste falharia por um motivo que nao tem a ver com o app.
const CHAVE = `chave-de-smoke-${Date.now().toString(36)}`;
const USER_ID = userIdFromSyncKey(CHAVE);
const TITULO = `Tarefa de smoke ${Date.now()}`;

const passos: string[] = [];
const ok = (msg: string) => { passos.push(`  ok   ${msg}`); console.log(`  ok   ${msg}`); };
const falha = (msg: string) => { passos.push(`  FALHA ${msg}`); console.log(`  FALHA ${msg}`); };

async function encolherLinha() {
  await cloudSync.client.from('app_state').upsert(
    {
      user_id: USER_ID,
      data: { nota: 'linha efemera de smoke test, pode apagar' },
      rev: 1,
      version: 0,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const errosConsole: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errosConsole.push(m.text()); });
  page.on('pageerror', (e) => errosConsole.push(`pageerror: ${e.message}`));

  // Chave injetada antes do app carregar: assim o gate e pulado e o app
  // tenta abrir direto o banco que este smoke vai criar.
  await page.addInitScript((chave) => {
    localStorage.setItem('focosemanal_sync_key', chave);
  }, CHAVE);

  console.log(`\n1. abrindo ${BASE}`);
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });

  console.log('2. esperando a carga terminar (Supabase)');
  let bancoVeio = false;
  try {
    await page.waitForFunction(
      () => !!document.querySelector('input[placeholder*="Buscar"]') ||
            !!document.querySelector('nav') ||
            document.body.innerText.includes('Olá,') ||
            document.body.innerText.includes('Bem-vindo'),
      { timeout: 45000 }
    );
    bancoVeio = true;
    ok('app renderizou depois da carga na nuvem');
  } catch {
    falha(`app nao renderizou em 45s. Texto na tela: "${(await page.textContent('body'))?.slice(0, 200)}"`);
  }

  if (bancoVeio) {
    const linha = await cloudSync.client
      .from('app_state').select('data').eq('user_id', USER_ID).maybeSingle();
    if (linha.error) falha(`leitura da linha no Supabase falhou: ${linha.error.message}`);
    else if (!linha.data) falha('app nao criou a linha da chave no Supabase');
    else {
      const dados = (linha.data as { data: { profile: { name: string } } }).data;
      ok(`linha existe no Supabase (profile.name = "${dados.profile.name}")`);
    }
  }

  console.log('3. criando uma tarefa pela interface');
  let tarefaCriada = false;
  if (bancoVeio) {
    const antes = await cloudSync.client
      .from('app_state').select('data').eq('user_id', USER_ID).single();
    const totalAntes = ((antes.data as { data: { tasks: unknown[] } }).data.tasks ?? []).length;

    // SmartInputBar e o campo de criação rápida na barra inferior.
    const campo = page.locator('input[placeholder*="Adicionar"], input[placeholder*="Nova"], input[placeholder*="tarefa" i]').first();
    if (await campo.count()) {
      await campo.fill(TITULO);
      await campo.press('Enter');
      await page.waitForTimeout(2500);
      tarefaCriada = true;
      ok(`preenchi "${TITULO}" e enviei`);
    } else {
      falha('nao achei o campo de criacao rapida');
    }

    const depois = await cloudSync.client
      .from('app_state').select('data').eq('user_id', USER_ID).single();
    const tarefas = ((depois.data as { data: { tasks: { title: string }[] } }).data.tasks ?? []);
    if (tarefas.length > totalAntes || tarefas.some(t => t.title === TITULO)) {
      ok(`a tarefa foi para o Supabase (${totalAntes} -> ${tarefas.length} tarefas)`);
    } else {
      falha(`a tarefa nao apareceu no Supabase (ainda ${tarefas.length})`);
      tarefaCriada = false;
    }
  }

  console.log('4. recarregando: o dado precisa voltar da nuvem');
  if (tarefaCriada) {
    await page.reload({ waitUntil: 'domcontentloaded' });
    try {
      await page.waitForFunction(
        (titulo) => document.body.innerText.includes(titulo),
        TITULO,
        { timeout: 45000 }
      );
      ok('apos recarregar, a tarefa continua na tela (veio do Supabase)');
    } catch {
      falha('a tarefa nao voltou depois do reload');
    }

    const storage = await page.evaluate(() => ({
      v5: localStorage.getItem('focosemanal_db_v5'),
      device: localStorage.getItem('focosemanal_device_id'),
      chave: localStorage.getItem('focosemanal_sync_key'),
    }));
    if (!storage.v5) ok('nenhuma copia do banco no localStorage');
    else falha('ainda existe copia do banco no localStorage');
    if (!storage.device) ok('nenhum id de dispositivo antigo no localStorage');
    else falha('o id de dispositivo antigo continua no localStorage');
    if (storage.chave) ok('apenas a credencial (chave) fica no navegador');
  }

  console.log('5. erros de runtime no console');
  const relevantes = errosConsole.filter(e =>
    !/favicon|manifest|ServiceWorker|sw\.js|Download the React DevTools/i.test(e)
  );
  if (relevantes.length === 0) ok('nenhum erro de console');
  else relevantes.forEach(e => falha(`console: ${e.slice(0, 220)}`));

  await page.screenshot({ path: '/tmp/opencode/smoke.png', fullPage: false });
  console.log('\nscreenshot: /tmp/opencode/smoke.png');

  await browser.close();
  await encolherLinha();
  console.log('\nlinha de teste encolhida (RLS nao deixa o anon apagar).');
  console.log(`  delete from app_state where user_id = '${USER_ID}';`);

  const problemas = passos.filter(p => p.includes('FALHA')).length;
  console.log(`\n${problemas === 0 ? 'TUDO OK' : `${problemas} PROBLEMA(S)`}`);
  process.exit(problemas === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error('erro no smoke:', e);
  try { await encolherLinha(); } catch { /* ignorado */ }
  process.exit(1);
});
