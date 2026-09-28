import React, { useCallback, useEffect, useRef, useState } from 'react';

const GIF_DIR = '/gifs';
const STILL_DIR = '/gifs/still';

export type GifName =
  | 'inicio'
  | 'tarefas'
  | 'semana'
  | 'jornada'
  | 'nova-tarefa'
  | 'modo-foco'
  | 'finalizar-dia'
  | 'modelos-rotina'
  | 'revisao-espacada'
  | 'lixeira'
  | 'metas'
  | 'configuracao'
  | 'fogo-sequencia'
  | 'tempo-total-cronometrado'
  | 'experiencia-acumulada'
  | 'tarefas-concluidas'
  | 'dia-chuvoso'
  | 'tarefa-estudo'
  | 'tarefa-saude'
  | 'tarefa-trabalho'
  | 'avatar-homem'
  | 'avatar-mulher'
  | 'foguete';

/** Assets que são um PNG puro: não têm animação nem frame estático separado. */
const STATIC_ONLY: Partial<Record<GifName, true>> = { foguete: true };

/**
 * Assets cujo arquivo incorporate um fundo branco opaco (640x640, sem alfa).
 * Sobre cartão branco o `mix-blend-mode: multiply` faz o branco sumir sem
 * precisar de recorte. Em fundos escuros/coloridos isso escureceria tudo —
 * nesses hostis passe `blend={false}`.
 */
const WHITE_BACKDROP: Partial<Record<GifName, true>> = {
  'fogo-sequencia': true,
  'tempo-total-cronometrado': true,
  'experiencia-acumulada': true,
  'tarefas-concluidas': true,
  'dia-chuvoso': true,
};

/** Duração real de um ciclo de cada GIF, em ms (soma dos atrasos dos frames). */
const LOOP_MS: Partial<Record<GifName, number>> = {
  'avatar-homem': 5140,
  'avatar-mulher': 5140,
  configuracao: 3020,
  'dia-chuvoso': 2000,
  'experiencia-acumulada': 4000,
  'finalizar-dia': 6600,
  'fogo-sequencia': 6000,
  inicio: 3870,
  jornada: 2870,
  lixeira: 1850,
  'modelos-rotina': 5040,
  metas: 2520,
  'modo-foco': 3020,
  'nova-tarefa': 5040,
  'revisao-espacada': 2520,
  semana: 2520,
  'tarefa-estudo': 5040,
  'tarefa-saude': 4040,
  'tarefa-trabalho': 4040,
  'tarefas-concluidas': 2880,
  tarefas: 6300,
  'tempo-total-cronometrado': 7200,
};

export const gifSrc = (name: GifName) =>
  `${GIF_DIR}/${name}.${STATIC_ONLY[name] ? 'png' : 'gif'}`;

export const gifStillSrc = (name: GifName) =>
  STATIC_ONLY[name] ? gifSrc(name) : `${STILL_DIR}/${name}.png`;

/** Elemento interativo que hospeda a ilustração e comanda a animação. */
const HOST_SELECTOR = 'button, a, [role="button"], [role="tab"], [data-gif-host]';

type IdleHandle = { cancel: () => void };

const onIdle = (fn: () => void): IdleHandle => {
  const ric = (
    window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }
  ).requestIdleCallback;

  if (typeof ric === 'function') {
    const id = ric(fn, { timeout: 4000 });
    return {
      cancel: () =>
        (window as unknown as { cancelIdleCallback: (i: number) => void }).cancelIdleCallback(id),
    };
  }
  const id = window.setTimeout(fn, 1200);
  return { cancel: () => window.clearTimeout(id) };
};

const preload = (src: string) => {
  const img = new Image();
  img.src = src;
};

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  return reduced;
}

/** Só conta como "foco de teclado"; clique de mouse não deve deixar o GIF solto. */
const isKeyboardFocus = (el: Element | null): boolean => {
  if (!el || typeof el.matches !== 'function') return false;
  try {
    return el.matches(':focus-visible');
  } catch {
    return false;
  }
};

interface GifIconProps {
  name: GifName;
  /** Frame estático até o ponteiro entrar no hospedeiro (ou foco de teclado). */
  playOnHover?: boolean;
  className?: string;
  alt?: string;
  /** Desliga o lazy loading (ícones acima da dobra). */
  eager?: boolean;
  /**
   * Sobrescreve o blend automático. Use `false` quando a ilustração for
   * exibida sobre um fundo escuro ou colorido.
   */
  blend?: boolean;
}

/**
 * Renderiza uma ilustração do acervo.
 *
 * Por padrão (regra do app) mostra o frame estático até o ponteiro entrar em
 * QUALQUER parte do elemento interativo que a hospeda (botão, link, aba ou
 * um container marcado com `data-gif-host`) — não só sobre o desenho —,
 * trocando para o GIF e voltando ao PNG na saída. Passe `playOnHover={false}`
 * para manter a animação contínua.
 */
export const GifIcon: React.FC<GifIconProps> = ({
  name,
  playOnHover = true,
  className = '',
  alt = '',
  eager = false,
  blend,
}) => {
  const reducedMotion = usePrefersReducedMotion();
  const boxRef = useRef<HTMLSpanElement>(null);
  const touchTimer = useRef<number | null>(null);
  const [active, setActive] = useState(false);

  const isStatic = Boolean(STATIC_ONLY[name]) || reducedMotion;
  const animated = isStatic ? gifStillSrc(name) : gifSrc(name);
  const still = gifStillSrc(name);

  const stopTouchTimer = useCallback(() => {
    if (touchTimer.current !== null) {
      window.clearTimeout(touchTimer.current);
      touchTimer.current = null;
    }
  }, []);

  // Pré-carrega o GIF enquanto o navegador está ocioso: evita o "piscar" no
  // hover sem competir com o first paint.
  useEffect(() => {
    if (isStatic || !playOnHover) return;
    const handle = onIdle(() => preload(animated));
    return () => handle.cancel();
  }, [isStatic, playOnHover, animated]);

  // Liga a animação no HOSPEDEIRO interativo, não no <span> da ilustração.
  useEffect(() => {
    const box = boxRef.current;
    if (!box || !playOnHover || isStatic) return;

    const host = (box.closest(HOST_SELECTOR) as HTMLElement | null) ?? box;

    const handlePointerEnter = (event: Event) => {
      // Toque não tem hover: no mobile o disparo é feito no pointerdown.
      if ((event as PointerEvent).pointerType === 'touch') return;
      setActive(true);
    };

    const handlePointerLeave = (event: Event) => {
      if ((event as PointerEvent).pointerType === 'touch') return;
      setActive(false);
    };

    const handleFocusIn = (event: Event) => {
      if (!isKeyboardFocus(event.target as Element)) return;
      setActive(true);
    };

    const handleFocusOut = () => setActive(false);

    // Mobile: um toque reproduz aproximadamente um ciclo e volta ao estático.
    const handlePointerDown = (event: Event) => {
      if ((event as PointerEvent).pointerType !== 'touch') return;
      setActive(true);
      stopTouchTimer();
      touchTimer.current = window.setTimeout(
        () => setActive(false),
        (LOOP_MS[name] ?? 2000) + 250
      );
    };

    host.addEventListener('pointerenter', handlePointerEnter);
    host.addEventListener('pointerleave', handlePointerLeave);
    host.addEventListener('focusin', handleFocusIn);
    host.addEventListener('focusout', handleFocusOut);
    host.addEventListener('pointerdown', handlePointerDown);

    return () => {
      host.removeEventListener('pointerenter', handlePointerEnter);
      host.removeEventListener('pointerleave', handlePointerLeave);
      host.removeEventListener('focusin', handleFocusIn);
      host.removeEventListener('focusout', handleFocusOut);
      host.removeEventListener('pointerdown', handlePointerDown);
      stopTouchTimer();
    };
  }, [playOnHover, isStatic, name, stopTouchTimer]);

  const src = !playOnHover || isStatic || active ? animated : still;
  const useBlend = blend ?? Boolean(WHITE_BACKDROP[name]);

  return (
    <span
      ref={boxRef}
      className={`inline-flex items-center justify-center shrink-0 ${className}`}
    >
      <img
        src={src}
        alt={alt}
        draggable={false}
        decoding="async"
        loading={eager || playOnHover ? 'eager' : 'lazy'}
        className={`w-full h-full object-contain pointer-events-none select-none ${
          useBlend ? 'mix-blend-multiply' : ''
        }`}
      />
    </span>
  );
};

/* ------------------------------------------------------------------ */
/* Avatar                                                             */
/* ------------------------------------------------------------------ */

interface ProfileAvatarProps {
  /** Valor cru de UserProfile.avatar: chave de GIF ou emoji legado. */
  value?: string;
  className?: string;
  playOnHover?: boolean;
  eager?: boolean;
  blend?: boolean;
}

const AVATAR_GIF: Record<string, GifName> = {
  foguete: 'foguete',
  homem: 'avatar-homem',
  mulher: 'avatar-mulher',
  'avatar-homem': 'avatar-homem',
  'avatar-mulher': 'avatar-mulher',
};

/** Emojis que podem existir em bancos de usuários criados antes das ilustrações. */
const LEGACY_AVATAR_GIF: Record<string, GifName> = {
  '🎓': 'foguete',
  '🧠': 'tarefa-estudo',
  '🎯': 'experiencia-acumulada',
  '⚡': 'experiencia-acumulada',
  '🔥': 'fogo-sequencia',
  '🦉': 'tarefa-trabalho',
};

export const DEFAULT_AVATAR: GifName = 'avatar-homem';

export const AVATAR_OPTIONS: GifName[] = [
  'avatar-homem',
  'avatar-mulher',
  'foguete',
  'tarefa-estudo',
  'tarefa-saude',
  'tarefa-trabalho',
  'fogo-sequencia',
  'experiencia-acumulada',
];

export const resolveAvatarGif = (value?: string): GifName | null => {
  if (!value) return DEFAULT_AVATAR;
  return AVATAR_GIF[value] ?? LEGACY_AVATAR_GIF[value] ?? null;
};

/** Slot de avatar: cai para o texto original quando o valor é desconhecido. */
export const ProfileAvatar: React.FC<ProfileAvatarProps> = ({
  value,
  className = '',
  playOnHover = true,
  eager = false,
  blend,
}) => {
  const gif = resolveAvatarGif(value);

  if (!gif) {
    return (
      <span className={`inline-flex items-center justify-center shrink-0 ${className}`}>
        {value}
      </span>
    );
  }

  return (
    <GifIcon name={gif} className={className} playOnHover={playOnHover} eager={eager} blend={blend} />
  );
};

/* ------------------------------------------------------------------ */
/* Badge de modo de estudo                                            */
/* ------------------------------------------------------------------ */

const BADGE_GIF: Record<string, GifName> = {
  '🔥': 'fogo-sequencia',
  '⚡': 'experiencia-acumulada',
};

/** Converte STUDY_MODES[mode].badge em ilustração quando existe arte. */
export const StudyModeBadge: React.FC<{ badge: string; className?: string; blend?: boolean }> = ({
  badge,
  className = 'w-5 h-5',
  blend,
}) => {
  const gif = BADGE_GIF[badge];
  if (!gif) {
    return (
      <span className={`inline-flex items-center justify-center shrink-0 ${className}`}>
        {badge}
      </span>
    );
  }
  return <GifIcon name={gif} className={className} blend={blend} />;
};
