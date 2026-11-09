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
