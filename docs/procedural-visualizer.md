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

1. Abra a versão local via npm start (localhost) ou site com HTTPS.
2. Inicie uma live no player YouTube do Lofi Radio.
3. Escolha um preset no seletor Visualizer.
4. Clique em "Ativar áudio real".
5. No seletor do navegador, escolha **esta aba / Lofi Radio**.
6. Ative **Compartilhar áudio da guia** e confirme.
7. Teste pausando ou trocando as músicas e observe os picos dos graves.
8. Para terminar, clique "Parar áudio real" ou interrompa o compartilhamento no navegador.

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
- view/website/home/home.component.* — botão de captura e seleção de efeitos

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

## Seletor de visualizadores (ícones)

O seletor utiliza um segundo `mat-expansion-panel` junto à paleta de cores.
Todos os presets têm `icon` (nome de Material Icon) configurável no arquivo
`src/app/services/visualizer-presets.ts`. Há também um botão com ícone de
visibilidade desativada para desligar o visualizador.

A janela de compartilhamento de áudio **não** aparece ao abrir o painel,
carregar a página ou restaurar o preset salvo. Ela só é solicitada depois de
um clique explícito no ícone de um efeito que ainda não tenha uma captura
ativa. Trocar de efeito com áudio compartilhado reutiliza a captura existente.
Clicar no ícone de desligar encerra o compartilhamento, incluindo capturas
que ainda estejam aguardando a permissão. Se o usuário cancelar o diálogo,
o botão do efeito pode ser clicado novamente para tentar outra vez.

O navegador continua podendo exibir seu indicador de compartilhamento enquanto
a análise do áudio estiver ativa; a aplicação não pode escondê-lo.

## UI layout, English labels and audio rendering

- Both palette and Visualizers panels use top-aligned, fixed-width columns; expanding one no longer vertically repositions the other.
- Icon tooltips and preset display names are English: Off, Waveform, Orbit, Spiral, Equalizer, Lissajous.
- The canvas is fixed to the viewport and layered above the page background, with player/controls above it.
- Render follows the energy of captured tab audio directly, not a possibly delayed YouTube `isPlaying` flag. With no audio energy, all modes remain hidden.
- The Web Audio analyser connects through a gain-zero output for processing without echo or duplicate playback.

## 2026-11-09: UI and tab permission fix

- Material's `mat-accordion` explicitly uses `[multi]="true"`, allowing the Palette and Visualizers panels to open independently.
- Both panels now occupy fixed 60px columns in a top-aligned CSS grid; expanding either one does not move the other header.
- The settings panel body padding override lives in the global `src/styles.css`, scoped to `.home-settings-accordion`, because Angular Material renders the internal body.
- The stray `fadeOut` animation and 100%-height palette list were removed. Angular Material now owns the expand/collapse timing.
- Each palette and visualizer selection has a tooltip; the panel headers and sharing/status indicators are also labeled.
- On preset selection, the `startCapture()` browser request runs before the preset state is published to subscribers. A canceled/denied request can be retried by clicking the same preset again.
- No audio capture happens just by opening either panel. The user must explicitly choose a visualizer and permit tab audio.
