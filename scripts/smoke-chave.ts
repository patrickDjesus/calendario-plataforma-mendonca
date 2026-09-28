/**
 * Smoke test do gate da chave de sincronização (nao entra no `npm test`).
 *
 * Cobre o que o outro smoke nao cobre: a primeira tela que o usuario ve, a
 * protecao contra chave digitada errada e a recusa de abrir o app sem a nuvem.
 *
 *   PLAYWRIGHT_BROWSERS_PATH=/tmp/opencode/pw npx tsx scripts/smoke-chave.ts
 */

import { chromium } from 'playwright-core';
import { cloudSync } from '../src/services/supabase';
import { userIdFromSyncKey } from '../src/services/syncKey';

const BASE = process.env.SMOKE_URL ?? 'http://localhost:3000';
// Sufixo unico por execucao: a RLS nao deixa o anon apagar linha, entao uma
// chave fixa faria a rodada seguinte abrir o banco da anterior em vez de
// exercitar o caminho que o teste quer exercitar.
const SUFIXO = Date.now().toString(36);
const CHAVE = `chave-smoke-gate-${SUFIXO}`;
const CHAVE_SEM_LINHA = `chave-sem-linha-${SUFIXO}`;
const CHAVE_OFFLINE = `chave-offline-${SUFIXO}`;
const USER_ID = userIdFromSyncKey(CHAVE);
const TYPO = `${CHAVE}-typo`;

let problemas = 0;
const ok = (m: string) => console.log(`  ok   ${m}`);
const falha = (m: string) => { problemas += 1; console.log(`  FALHA ${m}`); };

async function encolher(userId: string) {
  await cloudSync.client.from('app_state').upsert(
    {
      user_id: userId,
      data: { nota: 'linha efemera de smoke do gate, pode apagar' },
      rev: 1,
      version: 0,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );
}


async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const erros: string[] = [];
  page.on('pageerror', e => erros.push(e.message));

  console.log('\n1. sem chave: a tela de entrada aparece');
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('text=Sua chave de sincronização', { timeout: 45000 });
  ok('gate renderizou');
  const botao = page.locator('button:has-text("Entrar")');
  if (await botao.isDisabled()) ok('botao começa desabilitado');
  else falha('botao deveria comecar desabilitado');

  console.log('2. chave curta e repeticao divergente');
  await page.locator('input[type="password"]').first().fill('abc');
  await page.waitForTimeout(200);
  if (await botao.isDisabled()) ok('chave curta nao libera o botao');
  else falha('chave curta liberou o botao');

  await page.locator('input[type="password"]').first().fill(CHAVE);
  await page.locator('input[type="password"]').nth(1).fill('outra-coisa');
  await page.waitForTimeout(200);
  if (await botao.isDisabled()) ok('repeticao divergente nao libera o botao');
  else falha('repeticao divergente liberou o botao');

  console.log('3. chave que nao existe: pergunta antes de criar');
  await page.locator('input[type="password"]').nth(1).fill(CHAVE);
  await botao.click();
  await page.waitForSelector('text=Nao achei nenhum banco', { timeout: 30000 });
  ok('pediu confirmacao em vez de abrir um banco vazio');
  const criou = await cloudSync.client
    .from('app_state').select('user_id').eq('user_id', USER_ID).maybeSingle();
  if (criou.data === null) ok('nada foi criado no Supabase antes da confirmacao');
  else falha('criou a linha antes de perguntar');

  console.log('4. "voltar e conferir" volta ao formulario');
  await page.locator('button:has-text("Voltar e conferir a chave")').click();
  await page.waitForSelector('text=Sua chave de sincronização', { timeout: 10000 });
  const valor = await page.locator('input[type="password"]').first().inputValue();
  if (valor === '') ok('o campo foi limpo para redigitar');
  else falha(`o campo deveria estar vazio, esta "${valor}"`);

  console.log('5. criando o banco de verdade');
  await page.locator('input[type="password"]').first().fill(CHAVE);
  await page.locator('input[type="password"]').nth(1).fill(CHAVE);
  await botao.click();
  await page.waitForSelector('text=Criar meu banco do zero', { timeout: 30000 });
  await page.locator('button:has-text("Criar meu banco do zero")').click();
  await page.waitForFunction(
    () => document.body.innerText.includes('Olá,') || !!document.querySelector('nav'),
    { timeout: 45000 }
  );
  ok('app abriu depois de criar o banco');
  const linha = await cloudSync.client
    .from('app_state').select('data').eq('user_id', USER_ID).single();
  if (!linha.error && linha.data) ok('linha criada no Supabase');
  else falha(`linha nao criada: ${linha.error?.message}`);

  console.log('6. chave guardada sem linha: avisa que nasceu vazio, nao finge normalidade');
  await page.evaluate(k => localStorage.setItem('focosemanal_sync_key', k), CHAVE_SEM_LINHA);
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  try {
    await page.waitForSelector('text=Este banco nasceu vazio', { timeout: 30000 });
    ok('app avisou que o banco foi criado do zero');
    const temConferir = await page.locator('button:has-text("Conferir a chave")').count();
    if (temConferir) ok('oferece conferir a chave');
    else falha('sem botao para conferir a chave');
  } catch {
    falha('abriu um banco vazio sem avisar que nasceu vazio');
  }
  await page.screenshot({ path: '/tmp/opencode/smoke-chave-vazio.png' });

  console.log('7. "conferir a chave" devolve para a tela de entrada');
  await page.locator('button:has-text("Conferir a chave")').click();
  try {
    await page.waitForSelector('text=Sua chave de sincronização', { timeout: 15000 });
    const guardada = await page.evaluate(() => localStorage.getItem('focosemanal_sync_key'));
    if (guardada === null) ok('a chave que nao tinha linha saiu do navegador');
    else falha(`a chave deveria ter sido removida, ficou "${guardada}"`);
  } catch {
    falha('"conferir a chave" nao voltou para o gate');
  }

  console.log('8. sem nuvem o app recusa abrir (nao inventa banco)');
  const page2 = await ctx.newPage();
  await page2.addInitScript(k => localStorage.setItem('focosemanal_sync_key', k), CHAVE_OFFLINE);
  await page2.route('**/rest/v1/app_state**', r => r.abort('failed'));
  await page2.goto(BASE, { waitUntil: 'domcontentloaded' });
  try {
    await page2.waitForSelector('text=Nao consegui abrir seu banco', { timeout: 30000 });
    ok('tela de erro de conexao apareceu');
    const temRetry = await page2.locator('button:has-text("Tentar de novo")').count();
    if (temRetry) ok('botao de tentar de novo existe');
    else falha('sem botao de tentar de novo');
  } catch {
    falha('app abriu mesmo sem a nuvem (nao deveria)');
  }

  if (erros.length === 0) ok('nenhum erro de runtime');
  else erros.forEach(e => falha(`pageerror: ${e.slice(0, 200)}`));

  await browser.close();
  await encolher(USER_ID);
  await encolher(userIdFromSyncKey(CHAVE_SEM_LINHA));
  console.log(`\n${problemas === 0 ? 'TUDO OK' : `${problemas} PROBLEMA(S)`}`);
  console.log(
    '  Para apagar as linhas que este smoke criou:\n' +
    `  delete from app_state where user_id in ('${USER_ID}', '${userIdFromSyncKey(CHAVE_SEM_LINHA)}');`
  );
  process.exit(problemas === 0 ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
