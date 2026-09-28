/**
 * @vitest-environment jsdom
 *
 * Testes de DOM do comportamento interativo dos icones animados. O que roda
 * aqui nao tem como ser coberto pelos testes de logica pura: sao timers, o
 * evento `load` da <img> e a resolucao do hospedeiro via closest().
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent, cleanup, act } from '@testing-library/react';
import { GifIcon } from '../components/GifIcon';
import { TaskCard } from '../components/TaskCard';
import { TaskModal } from '../components/TaskModal';
import { Task, Category } from '../types';

/* ------------------------------------------------------------------ */
/* Ambiente                                                            */
/* ------------------------------------------------------------------ */

const matchMediaOriginal = window.matchMedia;

beforeEach(() => {
  vi.useFakeTimers();
  // jsdom nao implementa matchMedia nem idle callback.
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  (window as unknown as { requestIdleCallback?: unknown }).requestIdleCallback = undefined;
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  window.matchMedia = matchMediaOriginal;
});

/**
 * jsdom nao carrega imagens, entao `currentSrc` fica vazio e o `load` nunca
 * dispara sozinho. O GifIcon ancora o ciclo no load, entao o teste simula.
 */
const carregarGif = (img: Element, src: string) => {
  Object.defineProperty(img, 'currentSrc', { value: `http://localhost:3000${src}`, configurable: true });
  fireEvent.load(img);
};

const imgDe = (container: HTMLElement) => container.querySelector('img') as HTMLImageElement;
const enter = (host: Element) => fireEvent.pointerEnter(host, { pointerType: 'mouse' });
const leave = (host: Element) => fireEvent.pointerLeave(host, { pointerType: 'mouse' });

/** Roda o relogio do vitest dentro de act() para o React aplicar o re-render. */
const avancar = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });

/** jsdom nao implementa :focus-visible; stub temporario que delega o resto. */
const comFocoDeTeclado = <T,>(fn: () => T): T => {
  const original = Element.prototype.matches;
  Element.prototype.matches = function (this: Element, sel: string) {
    if (sel === ':focus-visible') return true;
    return original.call(this, sel);
  } as typeof Element.prototype.matches;
  try {
    return fn();
  } finally {
    Element.prototype.matches = original;
  }
};

/* ------------------------------------------------------------------ */
/* GifIcon                                                             */
/* ------------------------------------------------------------------ */

const LOOP_METAS = 2020; // ciclo real de metas.gif medido por scripts/gif-assets.mjs
const FOLGA = 80;        // LOOP_TAIL_MS

describe('GifIcon: hover no card', () => {
  it('troca para o GIF quando o ponteiro entra no card hospedeiro', () => {
    const { container } = render(
      <div data-gif-host><GifIcon name="metas" /></div>
    );
    const img = imgDe(container);
    expect(img.getAttribute('src')).toBe('/gifs/still/metas.png');

    enter(container.firstElementChild!);
    expect(img.getAttribute('src')).toBe('/gifs/metas.gif');
  });

  it('nao troca quando o evento vem do toque (no touch o gatilho e o pointerdown)', () => {
    const { container } = render(
      <div data-gif-host><GifIcon name="metas" /></div>
    );
    fireEvent.pointerEnter(container.firstElementChild!, { pointerType: 'touch' });
    expect(imgDe(container).getAttribute('src')).toBe('/gifs/still/metas.png');
  });

  it('ancora o ciclo no load, nao no momento do hover', () => {
    const { container } = render(
      <div data-gif-host><GifIcon name="metas" /></div>
    );
    const img = imgDe(container);
    enter(container.firstElementChild!);

    // 300ms de "decodificacao" antes do load nao podem contar no ciclo.
    avancar(300);
    carregarGif(img, '/gifs/metas.gif');
    avancar(500);
    leave(container.firstElementChild!);

    // O load foi em t=300 e o hover saiu em t=800: restam 1520ms de ciclo.
    avancar(LOOP_METAS - 500 + FOLGA - 1);
    expect(img.getAttribute('src')).toBe('/gifs/metas.gif');
    avancar(1);
    expect(img.getAttribute('src')).toBe('/gifs/still/metas.png');
  });

  it('termina o ciclo em andamento ao sair, sem cortar no meio', () => {
    const { container } = render(
      <div data-gif-host><GifIcon name="metas" /></div>
    );
    const host = container.firstElementChild!;
    const img = imgDe(container);

    enter(host);
    carregarGif(img, '/gifs/metas.gif');
    avancar(400);
    leave(host);

    avancar(LOOP_METAS - 400 - 1);
    expect(img.getAttribute('src')).toBe('/gifs/metas.gif');
    avancar(1 + FOLGA);
    expect(img.getAttribute('src')).toBe('/gifs/still/metas.png');
  });

  it('apos varios ciclos de hover o corte cai num multiplo do loop (regressao do corte no meio)', () => {
    const { container } = render(
      <div data-gif-host><GifIcon name="metas" /></div>
    );
    const host = container.firstElementChild!;
    const img = imgDe(container);

    enter(host);
    carregarGif(img, '/gifs/metas.gif');

    // Tres ciclos e meio de hover.
    const parada = 3 * LOOP_METAS + LOOP_METAS / 2;
    avancar(parada);
    leave(host);

    // A fase e parada % loop = loop/2, entao falta metade do ciclo.
    avancar(LOOP_METAS / 2 - 1);
    expect(img.getAttribute('src')).toBe('/gifs/metas.gif');
    avancar(1 + FOLGA);
    expect(img.getAttribute('src')).toBe('/gifs/still/metas.png');
  });

  it('sair antes do load nao corta pela metade: o ciclo roda inteiro e fecha no still', () => {
    const { container } = render(
      <div data-gif-host><GifIcon name="metas" /></div>
    );
    const host = container.firstElementChild!;
    const img = imgDe(container);

    enter(host);
    leave(host); // ponteiro saiu antes da imagem carregar: o fim do ciclo fica pendente
    expect(img.getAttribute('src')).toBe('/gifs/metas.gif');

    carregarGif(img, '/gifs/metas.gif');
    avancar(LOOP_METAS + FOLGA - 1);
    expect(img.getAttribute('src')).toBe('/gifs/metas.gif');
    avancar(1);
    expect(img.getAttribute('src')).toBe('/gifs/still/metas.png');
  });

  it('voltar a passar o mouse durante o fim do ciclo cancela o corte', () => {
    const { container } = render(
      <div data-gif-host><GifIcon name="metas" /></div>
    );
    const host = container.firstElementChild!;
    const img = imgDe(container);

    enter(host);
    carregarGif(img, '/gifs/metas.gif');
    avancar(LOOP_METAS - 100);
    leave(host);
    avancar(50);
    enter(host); // revertede antes de fechar
    avancar(500);
    expect(img.getAttribute('src')).toBe('/gifs/metas.gif');

    leave(host);
    avancar(LOOP_METAS + FOLGA);
    expect(img.getAttribute('src')).toBe('/gifs/still/metas.png');
  });

  it('playOnHover={false} fica sempre animado e ignora hover', () => {
    const { container } = render(
      <div data-gif-host><GifIcon name="fogo-sequencia" playOnHover={false} /></div>
    );
    const img = imgDe(container);
    expect(img.getAttribute('src')).toBe('/gifs/fogo-sequencia.gif');
    enter(container.firstElementChild!);
    expect(img.getAttribute('src')).toBe('/gifs/fogo-sequencia.gif');
  });
});

describe('GifIcon: teclado', () => {
  it('foco de teclado inicia e o fim do ciclo devolve o still', () => {
    comFocoDeTeclado(() => {
      const { container } = render(
        <div data-gif-host>
          <GifIcon name="metas" />
          <button type="button">acao</button>
        </div>
      );
      const host = container.firstElementChild!;
      const img = imgDe(container);

      // O foco de teclado cai no botao do card, nao na <span> da ilustracao.
      fireEvent.focusIn(host.querySelector('button')!, { relatedTarget: null });
      expect(img.getAttribute('src')).toBe('/gifs/metas.gif');
      carregarGif(img, '/gifs/metas.gif');

      // Sair do card (Tab para fora) fecha o ciclo; dentro do card, nao.
      fireEvent.focusOut(host.querySelector('button')!, { relatedTarget: null });
      avancar(LOOP_METAS + FOLGA);
      expect(img.getAttribute('src')).toBe('/gifs/still/metas.png');
    });
  });

  it('clique de mouse nao deixa o GIF solto', () => {
    const { container } = render(
      <div data-gif-host>
        <GifIcon name="metas" />
        <button type="button">acao</button>
      </div>
    );
    const img = imgDe(container);
    // Sem o stub, :focus-visible e false: um mousedown/foco por clique nao anima.
    fireEvent.focusIn(container.querySelector('button')!, { relatedTarget: null });
    avancar(3000);
    expect(img.getAttribute('src')).toBe('/gifs/still/metas.png');
  });

  it('Tab entre dois botoes do mesmo card nao congela a animacao', () => {
    comFocoDeTeclado(() => {
      const { container } = render(
        <div data-gif-host>
          <GifIcon name="metas" />
          <button type="button">um</button>
          <button type="button">dois</button>
        </div>
      );
      const host = container.firstElementChild!;
      const img = imgDe(container);
      const [um, dois] = Array.from(host.querySelectorAll('button'));

      fireEvent.focusIn(um);
      carregarGif(img, '/gifs/metas.gif');

      // Tab: o foco sai de "um" mas continua DENTRO do card hospedeiro.
      // Precisa passar de um ciclo inteiro: o corte prematuro so apareceria
      // depois do timer, nao imediatamente.
      fireEvent.focusOut(um, { relatedTarget: dois });
      avancar(LOOP_METAS + FOLGA + 500);
      expect(img.getAttribute('src')).toBe('/gifs/metas.gif');

      // Agora o foco sai do card de vez: o ciclo fecha normalmente.
      fireEvent.focusOut(dois, { relatedTarget: null });
      avancar(LOOP_METAS + FOLGA);
      expect(img.getAttribute('src')).toBe('/gifs/still/metas.png');
    });
  });
});

describe('GifIcon: touch', () => {
  it('um toque reproduz um ciclo e volta ao still', () => {
    const { container } = render(
      <div data-gif-host><GifIcon name="metas" /></div>
    );
    const host = container.firstElementChild!;
    const img = imgDe(container);

    fireEvent.pointerDown(host, { pointerType: 'touch' });
    carregarGif(img, '/gifs/metas.gif');
    expect(img.getAttribute('src')).toBe('/gifs/metas.gif');

    avancar(LOOP_METAS + 250);
    expect(img.getAttribute('src')).toBe('/gifs/still/metas.png');
  });
});

describe('GifIcon: movimento reduzido', () => {
  it('com prefers-reduced-motion o GIF nunca e montado', () => {
    window.matchMedia = ((query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;

    const { container } = render(
      <div data-gif-host><GifIcon name="metas" /></div>
    );
    const host = container.firstElementChild!;
    const img = imgDe(container);

    enter(host);
    expect(img.getAttribute('src')).toBe('/gifs/still/metas.png');
  });
});

/* ------------------------------------------------------------------ */
/* TaskCard: botao de chuva                                            */
/* ------------------------------------------------------------------ */

const tarefaBase: Task = {
  id: 't-1',
  title: 'Caminhada de 5km',
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
};

const catSaude: Category = { id: 'cat-saude', name: 'Saúde', color: '#F97316', icon: 'heart-pulse' };
const catEstudo: Category = { id: 'cat-estudo', name: 'Estudo', color: '#3B6CF5', icon: 'book' };

function renderCard(task: Task, category: Category, onToggleRain?: (t: Task) => void) {
  const noop = () => {};
  return render(
    <TaskCard
      task={task}
      category={category}
      isActiveTimer={false}
      isTimerRunning={false}
      activeElapsedSeconds={0}
      onToggleTimer={noop}
      onToggleComplete={noop}
      onEdit={noop}
      onDelete={noop}
      onToggleTop3={noop}
      onTogglePin={noop}
      onToggleRain={onToggleRain}
    />
  );
}

describe('TaskCard: marcação de chuva', () => {
  it('mostra o botão em tarefa de saúde', () => {
    const { container } = renderCard(tarefaBase, catSaude, () => {});
    expect(container.querySelector('[aria-pressed]')).not.toBeNull();
  });

  it('esconde o botão em tarefa que não é de saúde', () => {
    const { container } = renderCard(
      { ...tarefaBase, categoryId: 'cat-estudo', title: 'Revisar Termodinâmica' },
      catEstudo,
      () => {}
    );
    expect(container.querySelector('[aria-pressed]')).toBeNull();
  });

  it('esconde o botão quando o app não passa o handler', () => {
    const { container } = renderCard(tarefaBase, catSaude);
    expect(container.querySelector('[aria-pressed]')).toBeNull();
  });

  it('aciona o handler com a task e marca aria-pressed', () => {
    const onToggleRain = vi.fn();
    const { container } = renderCard(tarefaBase, catSaude, onToggleRain);
    const botao = container.querySelector('[aria-pressed]') as HTMLElement;

    expect(botao.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(botao);
    expect(onToggleRain).toHaveBeenCalledTimes(1);
    expect(onToggleRain.mock.calls[0][0]).toMatchObject({ id: 't-1' });
  });

  it('reflete a task já marcada', () => {
    const { container } = renderCard({ ...tarefaBase, blockedByRain: true }, catSaude, () => {});
    const botao = container.querySelector('[aria-pressed]') as HTMLElement;
    expect(botao.getAttribute('aria-pressed')).toBe('true');
    expect(container.textContent).toContain('Choveu');
  });
});

/* ------------------------------------------------------------------ */
/* TaskModal: seletor de categoria                                     */
/* ------------------------------------------------------------------ */

const CATEGORIAS: Category[] = [
  { id: 'cat-estudo', name: 'Estudo', color: '#3B6CF5', icon: 'book' },
  { id: 'cat-trabalho', name: 'Trabalho', color: '#8B5CF6', icon: 'briefcase' },
  { id: 'cat-saude', name: 'Saúde', color: '#F97316', icon: 'heart-pulse' },
  { id: 'cat-pessoal', name: 'Pessoal', color: '#EC4899', icon: 'user' },
  { id: 'cat-outros', name: 'Outros', color: '#64748B', icon: 'shapes' },
];

const abrirModal = (props: Partial<React.ComponentProps<typeof TaskModal>> = {}) => {
  const onSave = vi.fn();
  const onClose = vi.fn();
  const utils = render(
    <TaskModal
      isOpen
      onClose={onClose}
      onSave={onSave}
      categories={CATEGORIAS}
      initialDate="2026-09-28"
      {...props}
    />
  );
  const chips = () => Array.from(utils.container.querySelectorAll('[role="group"] button'));
  const chipDe = (nome: string) => chips().find((b) => b.textContent?.trim() === nome) as HTMLElement;
  const salvar = () => fireEvent.submit(utils.container.querySelector('form')!);
  return { ...utils, onSave, onClose, chips, chipDe, salvar };
};

describe('TaskModal: categoria', () => {
  it('renderiza um chip por categoria, na ordem, com a primeira ja selecionada', () => {
    const { chips } = abrirModal();
    expect(chips().map((b) => b.textContent?.trim())).toEqual([
      'Estudo', 'Trabalho', 'Saúde', 'Pessoal', 'Outros',
    ]);
    expect(chips()[0].getAttribute('aria-pressed')).toBe('true');
    expect(chips()[2].getAttribute('aria-pressed')).toBe('false');
  });

  it('os chips sao verticais e cabem em uma row', () => {
    const { chipDe } = abrirModal();
    for (const nome of ['Estudo', 'Trabalho', 'Saúde', 'Pessoal', 'Outros']) {
      const cls = chipDe(nome).className;
      expect(cls).toContain('flex-col');
      expect(cls).toContain('min-h-[104px]');
      expect(cls).toContain('min-w-[100px]');
    }
  });

  it('todas as categorias tem GIF: as padrao via CategoryIcon, pessoal/outros via GifIcon', () => {
    const { chipDe } = abrirModal();
    const gifDe = (nome: string) =>
      chipDe(nome).querySelector('img')?.getAttribute('src') ?? null;

    // Mapeamento do CategoryIcon (acervo existente) + as duas categorias novas.
    expect(gifDe('Estudo')).toBe('/gifs/still/tarefa-estudo.png');
    expect(gifDe('Trabalho')).toBe('/gifs/still/tarefa-trabalho.png');
    expect(gifDe('Saúde')).toBe('/gifs/still/tarefa-saude.png');
    expect(gifDe('Pessoal')).toBe('/gifs/still/pessoal.png');
    expect(gifDe('Outros')).toBe('/gifs/still/outros.png');
  });

  it('categoria sem GIF proprio cai no icone lucide (sem imagem quebrada)', () => {
    const { chipDe } = abrirModal({
      categories: [{ id: 'cat-x', name: 'Costura', color: '#0EA5E9', icon: 'scissors' }],
    });
    expect(chipDe('Costura').querySelector('img')).toBeNull();
  });

  it('trocar de categoria marca o novo chip e grava a escolha', () => {
    const { chipDe, salvar, onSave } = abrirModal();
    fireEvent.click(chipDe('Saúde'));
    expect(chipDe('Saúde').getAttribute('aria-pressed')).toBe('true');
    expect(chipDe('Estudo').getAttribute('aria-pressed')).toBe('false');

    fireEvent.change(document.querySelector('input[type="text"], input:not([type])')!, {
      target: { value: 'Caminhada' },
    });
    salvar();
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0]).toMatchObject({ title: 'Caminhada', categoryId: 'cat-saude' });
  });

  it('nao salva tarefa sem titulo', () => {
    const { salvar, onSave } = abrirModal();
    salvar();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('ao editar, mantem titulo e categoria existentes', () => {
    const { chipDe, salvar, onSave } = abrirModal({
      taskToEdit: { ...tarefaBase, title: 'Revisar Burnout', categoryId: 'cat-trabalho' },
    });
    expect(chipDe('Trabalho').getAttribute('aria-pressed')).toBe('true');
    salvar();
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ id: 't-1', title: 'Revisar Burnout', categoryId: 'cat-trabalho' })
    );
  });

  it('a categoria pessoal abre o GIF animado no hover do chip', () => {
    const { chipDe } = abrirModal();
    const img = chipDe('Pessoal').querySelector('img') as HTMLImageElement;
    enter(chipDe('Pessoal'));
    expect(img.getAttribute('src')).toBe('/gifs/pessoal.gif');
    carregarGif(img, '/gifs/pessoal.gif');
    leave(chipDe('Pessoal'));
    avancar(1620 + 80); // LOOP_MS pessoal + LOOP_TAIL_MS
    expect(img.getAttribute('src')).toBe('/gifs/still/pessoal.png');
  });
});
