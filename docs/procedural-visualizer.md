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
3. Ao lado do painel de paletas, use o seletor simples **Visualizer** (interface restaurada do primeiro commit desta branch).
4. Selecione um preset (Waveform, Orbit, Spiral, Equalizer ou Lissajous).
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
- view/website/home/home.component.* — seletor simples de presets; a captura inicia após escolher um efeito

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

## Visualizer icon selector

A paleta continua utilizando seu `mat-accordion` original. Ao lado dela,
o usuário agora encontra um **segundo accordion independente**, contendo:

- Ícone `equalizer` que abre e fecha as opções;
- Botão `Off` (`visibility_off`) para desativar e encerrar a captura;
- Cinco botões com ícones definidos em `VISUALIZER_PRESETS`: Waveform, Orbit,
  Spiral, Equalizer e Lissajous;
- `matTooltip` e rótulos acessíveis em todos os botões;
- Indicadores de permissão em andamento ou erro da captura de áudio.

O CSS `display: flex` introduzido pelo usuário em `.aside` foi preservado.
Os dois accordions são irmãos (não compartilham o estado de expansão).
Apenas o corpo do accordion do Visualizer recebe padding específico em
`src/styles.css`; o funcionamento e o estilo original da Palette não mudam.

A captura da aba continua sendo solicitada apenas após clicar no ícone de
um preset, reaproveitando `HomeComponent.selectVisualizer()`. Abrir o painel
não solicita permissão. A opção Off interrompe a captura.

As geometrias matemáticas, o analisador de áudio do YouTube com permissão,
as cores da paleta, as regras de silêncio e o Canvas permanecem inalterados.
