/**
 * Chave de sincronização — identidade do usuário no Supabase.
 *
 * A linha na nuvem é identificada pelo hash da sua chave, não por um UUID
 * aleatório guardado no navegador. Isso significa que a mesma chave, digitada
 * em qualquer dispositivo ou navegador, cai exatamente no mesmo banco — que é
 * o problema que impedia o app de "lembrar" de você.
 *
 * O que é local: apenas a CHAVE (é uma credencial, como uma senha). Nenhum
 * dado do app é gravado no navegador — tudo vive na tabela `app_state`.
 *
 * Sobre o hash: `cyrb128`, um hash de 128 bits rápido e sem dependência. Ele
 * NÃO é uma barreira de segurança (a segurança vem da entropia da chave em si,
 * que nunca é enviada ao servidor) — é só um identificador estável e sem
 * colisão prática para o caso de uso de usuário único. Escolhemos um hash em
 * JS puro, e não `crypto.subtle`, de propósito: `crypto.subtle` só existe em
 * contexto seguro, então o mesmo geraria ids diferentes em `localhost` e num
 * acesso por IP da rede local, quebrando o acesso de outro dispositivo.
 */

const SYNC_KEY_STORAGE = 'focosemanal_sync_key';
const LEGACY_DEVICE_ID_KEY = 'focosemanal_device_id';

/** Mínimo aceitável: curto o bastante para não ser digitar 30 caracteres. */
export const MIN_SYNC_KEY_LENGTH = 8;

/** cyrb128 — 128 bits, mesma saída em qualquer navegador. */
const cyrb128 = (input: string): string => {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < input.length; i++) {
    const k = input.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  const parts = [h1, h2, h3, h4].map((n) => (n >>> 0).toString(16).padStart(8, '0'));
  return parts.join('');
};

/** Normaliza: mesma chave escrita com maiúsculas/espaços cai no mesmo banco. */
export const normalizeSyncKey = (key: string): string => key.trim().toLowerCase();

export const isValidSyncKey = (key: string): boolean =>
  normalizeSyncKey(key).length >= MIN_SYNC_KEY_LENGTH;

/** user_id derivado da chave. Estável entre dispositivos e navegadores. */
export const userIdFromSyncKey = (key: string): string =>
  `pat-${cyrb128(normalizeSyncKey(key))}`;

export function getSyncKey(): string | null {
  if (typeof localStorage === 'undefined') return null;
  const stored = localStorage.getItem(SYNC_KEY_STORAGE);
  return stored && isValidSyncKey(stored) ? stored : null;
}

export function hasSyncKey(): boolean {
  return getSyncKey() !== null;
}

/** Guarda só a credencial. A chave nunca é enviada ao Supabase. */
export function setSyncKey(key: string): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(SYNC_KEY_STORAGE, key.trim());
}

/** Desconecta: some a credencial local, a linha na nuvem continua intacta. */
export function clearSyncKey(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(SYNC_KEY_STORAGE);
}

/**
 * Id do esquema antigo (UUID por dispositivo), lido uma única vez para trazer
 * os dados que já existiam na nuvem para dentro da linha da chave nova.
 */
export function getLegacyDeviceId(): string | null {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem(LEGACY_DEVICE_ID_KEY) || null;
}

export function clearLegacyDeviceId(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(LEGACY_DEVICE_ID_KEY);
}
