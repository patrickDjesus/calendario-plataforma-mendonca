# 📘 Documentação Completa da Plataforma Lumina

> **Guia definitivo e detalhado de design, arquitetura, funções, classes e telas da plataforma.**
> Este documento foi elaborado para fornecer uma visão clara, didática e aprofundada de tudo o que compõe o sistema, estruturado nas **4 janelas principais**: **Início**, **Tarefas**, **Semana** e **Jornada**.

---

## 🎨 0. Identidade Visual, Design System e Arquitetura Global

### 0.1 Sistema de Temas e Paleta Semântica (CSS Variables)
A plataforma utiliza variáveis CSS dinâmicas baseadas em temas (**Claro**, **Escuro** e **Automático/Sistema**), com tokens semânticos declarados no arquivo `/src/index.css`:

* **`--bg-app`**: Cor de fundo global da aplicação (`#0f172a` no dark, `#f8fafc` no light). Garante contraste suave sem fadiga visual.
* **`--surface`**: Fundo dos cards e contêineres principais (`#1e293b` no dark, `#ffffff` no light).
* **`--surface-secondary`**: Fundo secundário para hover, sub-seções, inputs e badges inativos.
* **`--borda`**: Linha sutil de delimitação (`rgba(255,255,255,0.08)` no dark e `#e2e8f0` no light).
* **`--primary`**: Cor de destaque principal (Roxo vibrante `#6366f1` / Índigo `#4f46e5`), usada em botões de ação primária, barras de progresso ativas e seleção de abas.
* **`--primary-hover`**: Variação tonal mais profunda (`#4338ca`) para estados de clique e foco.
* **`--texto`**: Cor de leitura primária de alto contraste (`#f8fafc` no dark, `#0f172a` no light).
* **`--texto-suave`**: Cor de leitura secundária para datas, descrições e legendas (`#94a3b8` no dark, `#64748b` no light).
* **`--sucesso`**, **`--aviso`**, **`--perigo`**: Semáforo visual para status de conclusão (`#10b981`), pendências/atenção (`#f59e0b`) e tarefas atrasadas/exclusão (`#ef4444`).

---

### 0.2 Física das Animações e Micro-Interações

#### A. Transição Elástica entre Janelas (Page Transition)
Configurada com a biblioteca `motion/react` no arquivo `src/App.tsx`:
* **Objeto**: `pageVariants`
* **Entrada (`initial` e `animate`)**: A nova janela surge com leve redução de escala (`scale: 0.84`), transladada no eixo Y (`y: ±55px`), leve inclinação angular (`rotateZ: ±3deg`) e desfoque ótico suave (`filter: blur(7px)`), expandindo-se para o tamanho real através de uma curva física de mola líquida (*spring physics*):
  * `stiffness: 320` (rigidez de resposta imediata)
  * `damping: 19` (amortecimento que gera o efeito elástico pop característico)
  * `mass: 0.7` (leveza de movimento)
* **Saída (`exit`)**: A janela atual se comprime suavemente (`scale: 0.86`) e se dissolve rapidamente (`duration: 0.19s`) para dar lugar à próxima sem atrasos perceptíveis.
* **Acessibilidade**: Ativa automaticamente `reducedVariants` (fade simples) caso o usuário tenha marcado a opção de redução de movimento no sistema operacional (`useReducedMotion`).

#### B. Efeito Cascata de Cards (Stagger Entrance)
Declarado em `src/index.css` via keyframe `@keyframes cardEntrance`:
* **Classes Utilitárias**:
  * `.animate-card-cascade`: Aplica animação de subida com perspectiva (`perspective(900px) rotateX(4deg)`) terminando em repouso plano (`rotateX(0deg)`).
  * `.stagger-1`: Delay de `0.04s` (primeiro bloco a carregar).
  * `.stagger-2`: Delay de `0.09s` (segundo bloco).
  * `.stagger-3`: Delay de `0.14s` (terceiro bloco).
  * `.stagger-4`: Delay de `0.19s` (quarto bloco).

---

## 🏠 PARTE 1: INÍCIO (Dashboard Diário — `DayDashboard`)

O **Início** é o centro nevrálgico do usuário. Ele foi desenhado para eliminar a paralisia de decisão matinal, respondendo instantaneamente a três perguntas:
1. *Como estou me sentindo hoje?*
2. *Qual é a coisa mais importante que devo fazer agora?*
3. *Como está meu progresso de pontos (XP) e sequência (Streak)?*

```
+-----------------------------------------------------------------------------------+
|  [ Header: Logo | Pomodoro Rápido | Sincronização Supabase | Perfil & Atalhos ]   |
+-----------------------------------------------------------------------------------+
|  [ Boas-Vindas & Data ] [ Modo de Estudo: Leve/Mod/Intenso/Caverna ] [ XP & Nível]|
+------------------------------------+----------------------------------------------+
| COLUNA 1 & 2: O FOCO DO DIA        | COLUNA 3: APOIO & CRONOGRAMA                 |
| - Registro de Humor & Energia      | - Widget Pomodoro / Foco Ativo               |
| - 🏆 TOP 3 Prioridades Primordiais | - Sugestão: "O Que Fazer Agora?"             |
| - Lista de Tarefas de Hoje         | - Linha do Tempo Diária (24h Timeline)       |
| - Ciclo de Estudos & Recomendações | - Acesso a Templates e Fechamento do Dia     |
+------------------------------------+----------------------------------------------+
```

### 1.1 Funcionalidades Detalhadas do Início

1. **Card de Boas-Vindas (`WelcomeCard.tsx`)**:
   * Saudações dinâmicas de acordo com o turno do dia (Bom dia, Boa tarde, Boa noite).
   * Contador de tarefas pendentes versus concluídas para a data de hoje.
   * Frases motivacionais adaptativas com base na consistência do usuário.

2. **Gamificação e Nível Diário (`UserProfile` & `STUDY_MODES`)**:
   * **Barra de XP**: Mostra o avanço atual rumo ao próximo nível (fórmula: `Level = floor(XP / 500) + 1`).
   * **Modos de Estudo**: Permite escolher entre 4 perfis de intensidade:
     * *Leve* (Meta: 200 XP/dia)
     * *Moderado* (Meta: 400 XP/dia)
     * *Intenso* (Meta: 700 XP/dia)
     * *Caverna* (Meta: 1000 XP/dia com foco extremo)
   * **Escudo de Sequência (*Streak Shield*)**: Concede automaticamente 1 proteção semanal. Se o usuário faltar um dia, o escudo é consumido e o contador de dias seguidos (*Streak*) não é zerado.

3. **Check-in de Humor e Energia (`DailyMood`)**:
   * Escala de 5 estados emocionais: *Ótimo* 😄, *Bom* 🙂, *Neutro* 😐, *Cansado* 🥱, *Estressado* 😣.
   * Nível de energia vital de 1 a 5 raios.
   * Campo para notas rápidas de reflexão matinal ou diária.

4. **Painel "Top 3 Prioridades do Dia"**:
   * Permite fixar até 3 tarefas cruciais. Tarefas no Top 3 recebem destaque visual dourado e badge de prioridade máxima, garantindo foco no essencial antes de qualquer distração.

5. **Lista de Tarefas de Hoje**:
   * Organização com separação entre tarefas pendentes e finalizadas.
   * Checkbox animado com micro-confetes e ganho imediato de XP (+15 a +50 XP dependendo da prioridade).
   * Suporte a sub-tarefas expansíveis com contador de conclusão (`x de y`).
   * Indicador de "Bloqueado por Chuva" para treinos ou atividades externas.
   * Tempo investido registrado diretamente na tarefa (`spentSeconds`).

6. **Sugestão Inteligente ("O que fazer agora?")**:
   * Algoritmo heurístico (`recommendNextTask`) que analisa tarefas pendentes com base em:
     * Tarefas marcadas no Top 3;
     * Nível de prioridade (Alta > Média > Baixa);
     * Horário agendado mais próximo;
     * Nível de energia atual informado no check-in de humor.

7. **Linha do Tempo Diária (`DailyTimeline.tsx`)**:
   * Visualização linear das 24 horas do dia.
   * Mapeia automaticamente tarefas que possuem horário estipulado (`HH:mm`), permitindo enxergar blocos de tempo livres e ocupados (*Time Blocking*).

### 1.2 Principais Classes e Estilos Utilizados no Início
* **Cards Principais**: `bg-[var(--surface)] border border-[var(--borda)] rounded-2xl p-5 shadow-[var(--shadow-card)]`
* **Botão de Ação Primária**: `bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-semibold py-2 px-4 rounded-xl shadow-md transition-all active:scale-95`
* **Barra de XP**: `h-2.5 w-full bg-[var(--surface-secondary)] rounded-full overflow-hidden` com preenchimento em `bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500`
* **Pill de Prioridade Alta**: `bg-red-500/10 text-red-500 border border-red-500/20 text-xs font-bold px-2 py-0.5 rounded-full`

---

## 📋 PARTE 2: TAREFAS (Central de Produtividade — `TasksInboxView`)

A janela **Tarefas** é o motor de execução da plataforma. Ela oferece múltiplos modelos mentais de visualização para organizar desde um único lembrete rápido até centenas de afazeres complexos.

```
+-----------------------------------------------------------------------------------+
|  [ Barra de Busca ] [ Filtro Categoria ] [ Filtro Prioridade ] [ Botão Nova + ]   |
|  [ Seletor de Modos: 📑 Lista | 📊 Kanban | 🎯 Eisenhower | 📅 Agendamento ]      |
+-----------------------------------------------------------------------------------+
|                                                                                   |
|  [ ÁREA DINÂMICA DE VISUALIZAÇÃO SELECIONADA ]                                   |
|  - Modo Lista: Inbox clássico agrupado, filtros de tags, ordenação drag-and-drop  |
|  - Modo Kanban: Colunas A Fazer, Em Progresso, Concluídas                         |
|  - Modo Eisenhower: 4 Quadrantes (Fazer, Agendar, Delegar, Eliminar)             |
|  - Modo Agendamento: Tarefas organizadas por Hoje, Amanhã, Semana e Sem Data     |
|                                                                                   |
+-----------------------------------------------------------------------------------+
|  [ Barra de Ações em Lote (Ao selecionar múltiplos itens) ]                       |
|  - [ Mover Data ]  [ Alterar Categoria ]  [ Marcar Concluídas ]  [ Lixeira ]       |
+-----------------------------------------------------------------------------------+
```

### 2.1 Os 4 Modos de Visualização

#### 1. Modo Lista (Inbox Inteligente)
* Visão limpa e densa, ideal para processamento rápido de tarefas.
* Suporte a agrupamento por data, categoria ou prioridade.
* Permite reordenar a prioridade visual e clicar diretamente para abrir o painel lateral de detalhes.

#### 2. Modo Kanban (Quadro Ágil)
* Três colunas padrão de fluxo: **A Fazer**, **Em Andamento** e **Concluídas**.
* Permite arrastar ou alterar rapidamente o status de um item de um estágio para o outro.
* Cabeçalho de coluna com contadores numéricos de tarefas.

#### 3. Modo Matriz de Eisenhower (Tomada de Decisão Estratégica)
Divide as tarefas em 4 quadrantes clássicos de produtividade com base em Urgência e Importância:
1. **Q1: Fazer Imediatamente** (Urgente & Importante — Prioridade Alta com data hoje ou atrasada);
2. **Q2: Planejar & Agendar** (Não Urgente, mas Importante — Prioridade Média/Alta com data futura);
3. **Q3: Delegar ou Otimizar** (Urgente, mas Pouco Importante — Prioridade Baixa com prazo curto);
4. **Q4: Eliminar ou Guardar** (Nem urgente nem importante — Ideias, backlog sem data).

#### 4. Modo Agendamento (Calendário / Prazos)
* Agrupa tarefas por horizontes temporais: **Atrasadas**, **Hoje**, **Amanhã**, **Esta Semana** e **Sem Data (Backlog)**.
* Facilita a limpeza de itens pendentes antigos com um único clique.

---

### 2.2 Recursos Avançados de Tarefas

1. **Drawer Lateral estilo Asana (`TaskDetailDrawer.tsx`)**:
   * Clicar em qualquer tarefa desliza suavemente um painel lateral completo do lado direito sem tirar o usuário da visualização atual.
   * Permite editar descrição rica, adicionar sub-tarefas com barra de progresso, registrar notas de reflexão pós-execução, anexar referências e ver o histórico de atividade.

2. **Ações em Lote (*Batch Actions*)**:
   * Ao selecionar duas ou mais tarefas através das caixas de seleção, surge uma barra flutuante inferior.
   * Permite mover todas as tarefas selecionadas para amanhã, alterar a categoria de todas em bloco, marcá-las como concluídas de uma vez ou enviá-las para a lixeira.

3. **Rollover Automático de Atrasos**:
   * Se habilitado nas configurações, tarefas não concluídas de dias anteriores geram um alerta discreto no topo permitindo trazê-las para "Hoje" em 1 clique.

4. **Lixeira com Retenção de 30 Dias**:
   * Tarefas excluídas não desaparecem para sempre: vão para uma lixeira interna onde podem ser restauradas com todos os seus metadados preservados.

### 2.3 Principais Classes e Estilos Utilizados em Tarefas
* **Coluna Kanban**: `bg-[var(--surface)] border border-[var(--borda)] rounded-2xl p-4 flex flex-col gap-3 min-h-[500px]`
* **Quadrante de Eisenhower**: `p-4 rounded-2xl border transition-all flex flex-col gap-2 min-h-[220px]`
* **Barra de Ações em Lote Flutuante**: `fixed bottom-6 left-1/2 -translate-x-1/2 bg-[var(--surface)] border border-[var(--borda)] shadow-2xl rounded-2xl px-6 py-3 flex items-center gap-4 z-50 animate-bounce-short`

---

## 📅 PARTE 3: SEMANA (Planejamento Semanal — `WeekView`)

A janela **Semana** é o centro tático da plataforma. Ela oferece ao usuário uma visão panorâmica de 7 dias, permitindo distribuir a carga de trabalho de forma humana e equilibrada, evitando sobrecargas em dias específicos.

```
+-----------------------------------------------------------------------------------+
|  [ < Semana Anterior ]   Semana de 28/Set a 04/Out   [ Próxima Semana > ]          |
|  [ 📊 Rebalancear Carga ]  [ 📋 Planejar Semana ]  [ 📅 Exportar .ICS p/ Google ] |
+-------+-------+-------+-------+-------+-------+-----------------------------------+
| SEG   | TER   | QUA   | QUI   | SEX   | SÁB   | DOM                               |
| 3h    | 4.5h  | 2h    | 5h    | 3h    | 1h    | Folga                             |
+-------+-------+-------+-------+-------+-------+-----------------------------------+
| Card  | Card  | Card  | Card  | Card  | Card  | (Dia livre ou tarefas leves)      |
| Card  | Card  |       | Card  | Card  |       |                                   |
|       | Card  |       |       |       |       |                                   |
| + Add | + Add | + Add | + Add | + Add | + Add | + Add                             |
+-------+-------+-------+-------+-------+-------+-----------------------------------+
```

### 3.1 Funcionalidades da Visão Semanal

1. **Grade Panorâmica dos 7 Dias**:
   * Exibição lado a lado dos dias da semana (com opção de início no Domingo ou na Segunda-feira).
   * O dia atual recebe destaque luminoso com anel colorido (`ring-2 ring-[var(--primary)]`).
   * Contador de horas estimadas no topo de cada dia para evitar dias com mais de 8 horas de carga teórica.

2. **Movimentação Rápida entre Dias**:
   * Botões de atalho em cada card permitem empurrar uma tarefa para o dia seguinte ou antecipá-la instantaneamente.
   * Botão `+ Adicionar Tarefa` no rodapé de cada coluna para inserir novos afazeres diretamente no dia escolhido.

3. **Assistente de Planejamento Guiado (`PlanWeekModal.tsx`)**:
   * Modal passo a passo para o início da semana:
     1. Revisão do que ficou pendente da semana anterior;
     2. Escolha dos 3 grandes objetivos prioritários da semana;
     3. Distribuição dos dias de estudo/trabalho e dos dias de descanso planejado.

4. **Rebalanceamento Inteligente de Tarefas**:
   * Algoritmo que detecta dias sobrecarregados (ex: mais de 6 tarefas pesadas na terça-feira) e sugere redistribuir o excesso para dias mais tranquilos (como quinta ou sexta-feira).

5. **Exportador Universal de Calendário (`.ICS`)**:
   * Gera um arquivo padrão RFC-5545 compatível nativamente com **Google Calendar**, **Apple Calendar**, **Microsoft Outlook** e **Notion Calendar**.
   * Converte tarefas com horários em compromissos reais de calendário com alarmes e descrições completas.

6. **Fechamento Diário Noturno (`CloseDayModal.tsx`)**:
   * Ritual noturno de encerramento do dia:
     * Parabeniza pelas tarefas concluídas e adiciona bônus de +20 XP de constância;
     * Permite adiar com tranquilidade o que sobrou para o dia seguinte;
     * Limpa o dashboard para a manhã seguinte.

### 3.2 Principais Classes e Estilos Utilizados na Semana
* **Grid de 7 Colunas**: `grid grid-cols-1 md:grid-cols-7 gap-3.5 w-full`
* **Coluna de Dia**: `bg-[var(--surface)] border border-[var(--borda)] rounded-2xl p-3.5 flex flex-col gap-2 min-h-[460px] transition-shadow hover:shadow-md`
* **Badge do Dia Atual**: `bg-[var(--primary)]/10 text-[var(--primary)] font-bold text-xs px-2 py-0.5 rounded-lg border border-[var(--primary)]/30`

---

## 🚀 PARTE 4: JORNADA (Gamificação & Métricas — `JourneyView`)

A janela **Jornada** é o espelho de evolução do usuário a médio e longo prazo. Nela, todo esforço diário é traduzido em dados visuais, troféus e métricas de constância, gerando dopamina positiva e motivação sustentável.

```
+-----------------------------------------------------------------------------------+
|  [ 🏆 2.450 XP ]     [ ⚡ Nível 5 ]     [ 🔥 18 Dias Seguidos ]   [ ⏱️ 42h Foco ]  |
+-----------------------------------------------------------------------------------+
|  📈 GRÁFICO LINEAR DE CONSTÂNCIA SEMESTRAL (ÚLTIMOS 6 MESES)                      |
|  [ Curva suave vetorial SVG com área em gradiente, pontos de foco e tooltips ]    |
+-----------------------------------------------------------------------------------+
|  🟩 MAPA DE CALOR DE HÁBITOS ESTILO GITHUB (CONTRIBUTIONS GRID)                   |
|  - Quadrícula de 365 dias colorida por intensidade de atividade                   |
+-----------------------------------------------------------------------------------+
|  📚 REPETIÇÃO ESPAÇADA (SM-2)          |  🏅 MURAL DE CONQUISTAS & TROFÉUS        |
|  - Flashcards e revisões [1d, 3d, 7d]  |  - Badges desbloqueadas e bloqueadas     |
+-----------------------------------------------------------------------------------+
```

### 4.1 Funcionalidades da Jornada

1. **Cards de Métricas Superiores**:
   * **Total de XP Acumulado**: Pontuação histórica ganha com tarefas, hábitos e blocos Pomodoro.
   * **Nível Atual**: Título honorífico correspondente (ex: *Iniciado*, *Disciplinado*, *Mestre do Foco*).
   * **Sequência Ininterrupta (*Streak*)**: Dias consecutivos em que o usuário bateu suas metas.
   * **Horas Totais de Foco Real**: Medição rigorosa dos cronômetros concluídos sem distrações.

2. **Gráfico Linear de Constância Semestral (SVG Vetorial Interativo)**:
   * Mapeia os últimos 6 meses com resolução precisa de dados.
   * Desenha uma curva Bézier suave e contínua (`d="M... C..."`) calculada por interpolação de pontos de controle.
   * Preenchimento inferior com gradiente semitransparente em tons índigo/violeta (`linearGradient`).
   * **Pontos Interativos (*Hover Dots*)**: Ao passar o mouse ou o dedo sobre qualquer ponto da curva:
     * O ponto cresce suavemente com anel de brilho;
     * Uma linha-guia pontilhada vertical desce até o eixo X;
     * Um tooltip flutuante exibe a data formatada, o total de tarefas completadas e o XP conquistado naquele dia.
   * Eixo Y com marcadores de escala e eixo X com abreviações de meses.

3. **Mapa de Calor de Hábitos (Estilo GitHub)**:
   * Visualização matricial de 52 semanas por 7 dias.
   * Cores em 4 tons de verde/esmeralda conforme a quantidade de tarefas e hábitos concluídos no dia (desde o cinza sem atividade até o verde vibrante para dias de alta produtividade).

4. **Sistema de Repetição Espaçada (*Spaced Repetition* / Algoritmo SM-2)**:
   * Criado especialmente para estudantes de concurso, vestibular, idiomas e medicina.
   * Ao finalizar uma tarefa com tema de estudo, o sistema pode programar revisões automáticas espaçadas em **1 dia**, **3 dias**, **7 dias** e **15 dias**.
   * Notifica o usuário no dia exato em que um tópico está prestes a entrar na curva de esquecimento.

5. **Mural de Conquistas e Troféus (`achievements`)**:
   * Sistema com mais de 25 medalhas colecionáveis:
     * *Primeiro Passo*: Concluiu a primeira tarefa.
     * *Semana de Ferro*: 7 dias consecutivos de streak.
     * *Centurião*: 100 tarefas finalizadas.
     * *Madrugador*: Concluiu 3 tarefas antes das 8h da manhã.
     * *Mestre Zen*: Registrou humor e energia por 14 dias seguidos.
   * Conquistas bloqueadas exibem a barra de porcentagem restante para desbloqueio.

6. **Correlação entre Humor e Produtividade**:
   * Gráfico de dispersão cruzada que demonstra ao usuário se os dias em que ele rende mais são os dias de bom humor ou descanso adequado, incentivando hábitos saudáveis de sono e nutrição.

### 4.2 Principais Classes e Estilos Utilizados na Jornada
* **Contêiner do Gráfico**: `bg-[var(--surface)] border border-[var(--borda)] rounded-2xl p-6 shadow-[var(--shadow-card)] relative overflow-hidden`
* **Card de Troféu Desbloqueado**: `bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-center gap-3.5 text-amber-500`
* **Célula do Heatmap**: `w-3 h-3 rounded-sm transition-all hover:scale-125 cursor-pointer`

---

## 🗄️ 5. Persistência de Dados e Supabase (Como Funciona)

### 5.1 O Modelo de Snapshot Único (`app_state`)
A persistência da plataforma foi concebida sob o princípio da **Fonte Única da Verdade**:
* **Tabela no Supabase**: `app_state`
* **Chave Primária**: `user_id` (calculada como hash SHA-256 da Chave de Sincronização do usuário).
* **Coluna de Dados**: `data` (JSONB com a estrutura completa do `DatabaseSchema`).
* **Como funciona**:
  1. Cada ação do usuário (criar tarefa, concluir hábito, registrar humor) atualiza o estado em memória do React;
  2. O repositório central (`src/services/repository.ts`) envia um snapshot assíncrono para o Supabase;
  3. Se houver queda de internet, as alterações permanecem salvas na fila de memória e o indicador de conexão sinaliza `offline` ou `error`, sincronizando assim que a rede restabelecer;
  4. Ao usar a mesma chave em outro navegador ou celular, todo o banco é baixado instantaneamente.

### 5.2 Nenhuma Alteração Necessária no Supabase
* Todas as inovações visuais recentes (**Transição Elástica**, **Animações em Cascata**, **Gráfico Linear de 6 Meses** e **Filtros Avançados**) operam puramente no frontend.
* Elas utilizam as colunas e a tabela `app_state` já existentes. **Nenhuma migration SQL, nova tabela ou coluna precisa ser criada ou alterada no painel do Supabase.**

---

## ⌨️ 6. Atalhos Globais de Teclado (Produtividade Extrema)

A plataforma conta com um sistema de escuta global de atalhos rápidos:
* **`N`**: Abre o modal para criação imediata de uma Nova Tarefa.
* **`Espaço`** (quando focado numa tarefa): Inicia ou pausa o cronômetro Pomodoro de foco.
* **`Ctrl + K`** ou **`Cmd + K`**: Abre a **Command Palette** (busca global em toda a plataforma).
* **`1`**: Pula para a janela **Início**.
* **`2`**: Pula para a janela **Tarefas**.
* **`3`**: Pula para a janela **Semana**.
* **`4`**: Pula para a janela **Jornada**.
* **`Esc`**: Fecha qualquer modal, drawer lateral ou menu aberto.

---

## 📝 Resumo Geral das Telas

| Janela / Seção | Componente React | Foco Principal | Diferencial Chave |
| :--- | :--- | :--- | :--- |
| **Início** | `DayDashboard.tsx` | O que fazer hoje | Top 3 prioritário, XP diário, Pomodoro e Sugestão inteligente |
| **Tarefas** | `TasksInboxView.tsx` | Como organizar tudo | 4 Modos (Lista, Kanban, Eisenhower, Agendamento) + Drawer Asana |
| **Semana** | `WeekView.tsx` | Planejamento tático de 7 dias | Carga horária por dia, Rebalanceamento e Exportação `.ICS` |
| **Jornada** | `JourneyView.tsx` | Constância e gamificação | Gráfico linear semestral, Mapa de calor, SM-2 e Conquistas |
