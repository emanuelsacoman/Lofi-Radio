# Lofi Radio — Visualizador com áudio real

Branch: feature/chatgpt-visualizer

## O que mudou

O visualizador agora pode reagir ao áudio REAL da live selecionada:
- Captura da aba com permissão explícita do usuário (getDisplayMedia)
- Web Audio AnalyserNode: FFT, intensidade RMS, graves, médios, agudos
- Detector adaptativo de batidas a partir de transientes de graves (estimativa)
- 64 bandas espectrais para barras e energia para as outras geometrias
- Cores herdadas dinamicamente do tema selecionado (sem hex fixo nos presets)
- Um único canvas e um único loop. Sem áudio compartilhado, a forma fica estática.

## Ativação no navegador

1. Abra o Lofi Radio em localhost ou HTTPS.
2. Inicie uma live no player YouTube.
3. Clique no ícone **Visualizers** ao lado do ícone Palette para abrir as opções.
4. Clique no ícone de um preset (Waveform, Orbit, Spiral, Equalizer ou Lissajous).
5. O navegador solicita imediatamente o compartilhamento. Escolha **a aba do Lofi Radio** e habilite **Compartilhar áudio da guia**.
6. Para trocar de efeito, escolha outro preset. Para encerrar a captura, selecione **Off**.
7. Se a permissão for cancelada, selecione **Off** e depois o preset desejado para tentar novamente.

**IMPORTANTE:** Não escolha outra aba, monitor ou janela. O navegador
pode não fornecer uma faixa de áudio, mesmo com audio:true.
A captura exige intervenção explícita, não pode ser iniciada automaticamente.
Há suporte variável entre navegadores; priorize Chrome/Edge desktop.

A API do iframe do YouTube NÃO disponibiliza áudio bruto por CORS/Web Audio.
Este fluxo capta o que a aba reproduz, depois de consentimento. Não usa
microfone, não transmite, armazena, grava ou faz upload dos dados de áudio.
O vídeo capturado não é renderizado. Todos os tracks são parados quando
desativado, quando o componente sai da página ou quando a captura termina.

## Organização

- services/visualizer-audio.service.ts — captura autorizada e extrator FFT
- services/interfaces/visualizer/visualizer-audio-frame.ts — contrato dos dados
- services/visualizer.service.ts — geometrias moduladas por frequências reais
- services/visualizer-presets.ts — presets com audioSensitivity configurável
- view/effect/visualizer/visualizer.component.ts — Canvas e ciclo de renderização
- view/website/home/home.component.* — dois menus independentes de ícones; a captura inicia após escolher um efeito

## Ajustes diretos no código

\`src/app/services/visualizer-presets.ts\`:

- \`audioSensitivity\`: 0.2 a 4 (quanto o visual reage a cada batida)
- \`amplitude\`: escala de deformação
- \`barCount\`: número de barras; usam espectro real, não seno simulado
- \`color\` e \`secondaryColor\`: theme, secondary, accent, accentLight, text
- \`layers\`, \`glow\`, \`opacity\`, \`lineWidth\`: acabamento visual

\`VisualizerAudioService.readFrame()\` produz {level,bass,mids,treble,beat,spectrum}.
A detecção de beats é heurística: marca picos de grave, não identifica
automaticamente BPM/perfeita sincronização de todos os tipos de música.

## Comandos de validação

\`\`\`bash
npm ci
npm run build
npx ng test --watch=false --include=src/app/services/visualizer.service.spec.ts --include=src/app/services/visualizer-audio.service.spec.ts
npm run test:radio
\`\`\`

Não há deploy nesta branch. Valide a captura na interface real do navegador.

## Comportamento no silencio e posicao das barras

- Pulse Bars agora usa a base do Canvas (y=1): cada barra parte da borda inferior e cresce para cima.
- Sem frequencias detectaveis, a altura de cada barra e exatamente zero.
- Todos os presets usam um limiar de ruido e uma atividade normalizada de audio para diminuir geometria e opacidade; sem audio ficam invisiveis.
- O decaimento do detector de batidas, isoladamente, nao gera movimento no silencio.
- Para testar: pare/retome a live, silencie o audio da live e observe a borda inferior. A captura da aba deve estar ativa.

## Absolute-positioned settings menus

A Palette e o Visualizer agora utilizam botões e menus HTML independentes,
sem `mat-accordion` nem `mat-expansion-panel`. Esses componentes adicionavam
espaçamentos e margens internas que, combinados com a largura flexível da barra,
desalinhavam os ícones do início das colunas.

O contêiner `.aside` está em `position: absolute; left: 0;`, com duas
colunas também absolutas, de 64px cada, em `left: 0` e `left: 80px`.
O cabeçalho e as opções de cada coluna compartilham **exatamente a mesma largura**.
A abertura usa uma transição curta de opacidade e `translateY`, sem alterar
as coordenadas da outra coluna. A preferência por movimento reduzido é respeitada.

As duas colunas têm tooltips e estados acessíveis (`aria-expanded`,
`aria-pressed`, `aria-controls`). Os menus são criados com `*ngIf`
somente durante a expansão, evitando que elementos ocultos com `inert`
ou `pointer-events: none` interfiram nos cliques.
Os estados `paletteExpanded` e `visualizerExpanded` são independentes no
`HomeComponent`; expandir um não expande nem reposiciona o outro.

O menu Palette mantém as mesmas cores carregadas do Firebase, indicação
de novos temas e persistência da seleção. O menu Visualizers preserva
as cinco opções, o botão Off e o indicador de captura.

**A captura de áudio é solicitada somente após o usuário clicar no ícone de
um visualizador**, usando o mesmo `selectVisualizer()` já existente; a
abertura dos menus não solicita nenhuma permissão. Os cálculos, a análise
de áudio, o Canvas, os presets e a lógica de silêncio permanecem inalterados.

O indicador de compartilhamento pertence ao navegador e permanece visível
durante a captura autorizada.

## Correção de clique e tooltip — isolamento do contexto de empilhamento

- O `main.fadeIn` recebe uma animação com `animation-fill-mode: forwards`,
  que pode criar um contexto de empilhamento próprio. A barra `.aside`
  foi movida para **depois de `</main>`**, como irmã do conteúdo animado,
  permanecendo dentro do componente Angular.
- O CSS dos menus foi transferido do bloco `body main` para seletores
  locais ao componente, porque `.aside` não é mais descendente de `main`.
- A barra usa `position: fixed`, `z-index: 200`, `pointer-events: auto`;
  os filhos clicáveis também recebem `pointer-events: auto`. Não há
  dependência de um ancestral não interativo.
- As opções continuam sendo criadas com `*ngIf`, com animação de 180ms.
- O painel de áudio só pede permissão depois de clicar em um dos presets;
  a paleta continua chamando `setTheme()`. A distância e o tamanho dos
  ícones não foram alterados.
- O overlay padrão de tooltip do Angular CDK (z-index 1000) pode ser
  renderizado acima da barra (z-index 200).

### Diagnóstico no navegador (somente se persistir)

Abra DevTools (F12) e execute:

```js
const button = document.querySelector('.visual-control--palette .visual-control__trigger');
const r = button.getBoundingClientRect();
const x = r.left + r.width / 2;
const y = r.top + r.height / 2;
console.log({
  center: {x, y},
  above: document.elementFromPoint(x, y),
  sameTarget: button.contains(document.elementFromPoint(x, y)),
  pointerEvents: getComputedStyle(button).pointerEvents
});
```

`sameTarget` deve ser `true` e `pointerEvents` deve ser `auto`.
Se não forem, haverá outra camada cobrindo o controle.
