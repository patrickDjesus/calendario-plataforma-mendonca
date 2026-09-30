/**
 * Porta de entrada do app: a chave de sincronização.
 *
 * O banco vive no Supabase e a linha dele é identificada pelo hash da chave.
 * Isso cria um risco de Digitação que precisa ser tratado na tela: se a chave
 * estiver errada, o app abriria um banco vazio e o usuário acharia que perdeu
 * tudo. Por isso, quando a chave não encontra nada, a tela pergunta antes de
 * criar um banco novo.
 */

import React, { useState } from 'react';
import { KeyRound, Loader2, AlertTriangle, Eye, EyeOff, Check } from 'lucide-react';
import { cloudSync, CloudUnavailableError } from '../services/supabase';
import {
  userIdFromSyncKey,
  isValidSyncKey,
  MIN_SYNC_KEY_LENGTH,
} from '../services/syncKey';

type Fase = 'digitando' | 'procurando' | 'confirmando-novo';

interface SyncKeyGateProps {
  /** Conecta com uma chave que ja tem dados. */
  onConnect: (key: string) => Promise<void>;
}

export const SyncKeyGate: React.FC<SyncKeyGateProps> = ({ onConnect }) => {
  const [chave, setChave] = useState('');
  const [repetir, setRepetir] = useState('');
  const [ver, setVer] = useState(false);
  const [fase, setFase] = useState<Fase>('digitando');
  const [erro, setErro] = useState<string | null>(null);

  const valida = isValidSyncKey(chave);
  const combina = repetir.length === 0 || repetir === chave;

  const buscar = async () => {
    if (!valida || fase !== 'digitando') return;
    setErro(null);
    setFase('procurando');
    try {
      const row = await cloudSync.pull(userIdFromSyncKey(chave));
      if (row) {
        await onConnect(chave);
        return;
      }
      // Nada com essa chave: pode ser chave nova ou chave digitada errada.
      // Criar aqui sem perguntar faria o usuario achar que perdeu os dados.
      setFase('confirmando-novo');
    } catch (e) {
      setErro(
        e instanceof CloudUnavailableError
          ? 'Nao consegui falar com o Supabase. Verifique a internet e tente de novo.'
          : 'Falha inesperada ao procurar seu banco.'
      );
      setFase('digitando');
    }
  };

  const criarNovo = async () => {
    setFase('procurando');
    try {
      await onConnect(chave);
    } catch (e) {
      setErro(
        e instanceof CloudUnavailableError
          ? 'O Supabase recusou a criacao do banco. Tente de novo.'
          : 'Nao consegui criar seu banco.'
      );
      setFase('confirmando-novo');
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[var(--surface)] rounded-3xl border border-[var(--borda)] shadow-xl p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-11 h-11 rounded-2xl bg-[var(--primary)] flex items-center justify-center text-white shadow-lg shadow-violet-500/30">
            <KeyRound size={22} strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-lg font-black text-[var(--texto)]">Sua chave de sincronização</h1>
            <p className="text-xs text-[var(--texto-suave)]">Plataforma Mendonça</p>
          </div>
        </div>

        {fase === 'confirmando-novo' ? (
          <div className="mt-6">
            <div className="flex gap-3 p-4 rounded-2xl bg-amber-50 border border-amber-200 mb-4">
              <AlertTriangle size={20} className="text-amber-600 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-900 leading-relaxed">
                Nao achei nenhum banco com essa chave. Se voce digitou errado, seus dados
                continuam la — volte e confira. Se e a primeira vez, crie um banco novo.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={criarNovo}
                className="w-full py-3 rounded-2xl bg-[var(--primary)] text-white font-bold hover:opacity-90 transition-opacity cursor-pointer"
              >
                Criar meu banco do zero
              </button>
              <button
                type="button"
                onClick={() => {
                  setFase('digitando');
                  setChave('');
                  setRepetir('');
                  setErro(null);
                }}
                className="w-full py-3 rounded-2xl border border-[var(--borda)] font-bold text-[var(--texto-suave)] hover:bg-[var(--surface-secondary)] transition-colors cursor-pointer"
              >
                Voltar e conferir a chave
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm text-[var(--texto-suave)] leading-relaxed mt-4 mb-5">
              Tudo o que voce criar fica no <strong className="text-[var(--texto)]">Supabase</strong>,
              nao neste navegador. A chave e o que abre o seu banco: use a mesma em
              qualquer dispositivo e voce cai exatamente nos mesmos dados.
            </p>

            <label className="block text-xs font-semibold text-[var(--texto-suave)] mb-1.5">
              Chave de sincronização
            </label>
            <div className="relative">
              <input
                type={ver ? 'text' : 'password'}
                value={chave}
                onChange={(e) => setChave(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') buscar(); }}
                placeholder={`minimo ${MIN_SYNC_KEY_LENGTH} caracteres`}
                autoFocus
                className="w-full py-3 pl-4 pr-11 rounded-2xl border border-[var(--borda)] bg-[var(--surface-secondary)] text-[var(--texto)] font-medium focus:outline-none focus:border-[var(--primary)] transition-colors"
              />
              <button
                type="button"
                onClick={() => setVer(v => !v)}
                aria-label={ver ? 'Ocultar chave' : 'Mostrar chave'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--texto-suave)] hover:text-[var(--texto)] cursor-pointer"
              >
                {ver ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {chave.length > 0 && !valida ? (
              <p className="text-xs text-amber-600 mt-1.5">
                Faltam {MIN_SYNC_KEY_LENGTH - chave.trim().length} caracteres.
              </p>
            ) : (
              <p className="text-xs text-[var(--texto-suave)] mt-1.5 flex items-center gap-1">
                {chave.length >= MIN_SYNC_KEY_LENGTH && <Check size={12} className="text-emerald-500" />}
                Use algo que voce lembre: nao ha como recuperar sem o painel do Supabase.
              </p>
            )}

            <label className="block text-xs font-semibold text-[var(--texto-suave)] mt-4 mb-1.5">
              Repetir a chave
            </label>
            <input
              type={ver ? 'text' : 'password'}
              value={repetir}
              onChange={(e) => setRepetir(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') buscar(); }}
              placeholder="digite de novo para confirmar"
              className="w-full py-3 px-4 rounded-2xl border border-[var(--borda)] bg-[var(--surface-secondary)] text-[var(--texto)] font-medium focus:outline-none focus:border-[var(--primary)] transition-colors"
            />
            {!combina && (
              <p className="text-xs text-red-500 mt-1.5">As duas chaves nao batem.</p>
            )}

            {erro && (
              <p className="text-xs text-red-500 mt-4 p-3 rounded-xl bg-red-50 border border-red-100">
                {erro}
              </p>
            )}

            <button
              type="button"
              onClick={buscar}
              disabled={!valida || !combina || fase === 'procurando'}
              className="w-full mt-5 py-3 rounded-2xl bg-[var(--primary)] text-white font-bold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {fase === 'procurando' ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Procurando seu banco...
                </>
              ) : (
                'Entrar'
              )}
            </button>

            <p className="text-[11px] text-[var(--texto-suave)] mt-4 leading-relaxed">
              A chave nunca e enviada ao servidor: o app guarda localmente e usa o
              hash dela como identificador da sua linha no Supabase.
            </p>
          </>
        )}
      </div>
    </div>
  );
};
