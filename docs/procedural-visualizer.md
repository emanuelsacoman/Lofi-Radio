# Lofi Radio — Procedural Visualizer

Branch: feature/audio-visualizer. Angular 16 + Canvas 2D. Sem bibliotecas de renderizacao adicionais.

## Onde configurar

Edite \`src/app/services/visualizer-presets.ts\`. Cada entrada no array
\`VISUALIZER_PRESETS\` e uma variacao independente do mesmo motor matematico.

- \`geometry\`: wave, circle, spiral, bars, lissajous.
- \`amplitude\`: 0-100, intensidade.
- \`frequency\`: 0.25-12, repeticoes no espaco.
- \`speed\`: 0-5, ciclos simulados por segundo.
- \`harmonics\`: 1-12, ondas compostas.
- \`phase\`: -360..360 graus.
- \`color\`, \`secondaryColor\`: hexadecimal, \`theme\` ou \`accent\`.
- \`lineWidth\`: 0.5-10 pixels.
- \`glow\`: 0-40 pixels.
- \`opacity\`: 0-1.
- \`layers\`: 1-8 curvas.
- \`resolution\`: 48-768 pontos por curva.
- \`barCount\`: 12-96 barras.
- \`rotation\`: -5..5 rad/s (para orbitas e espirais).

A selecao de preset e persistida em \`localStorage\` com chave
\`lofi.visualizer.preset.v1\`; a opcao Off desativa a renderizacao.
A edicao de parametros em runtime e feita via \`VisualizerService.updateParameters\`.
Para restaurar os valores de fabrica, use \`resetParameters()\`.

## Arquitetura

\`VisualizerService\`: guarda a unica configuracao ativa, valida parametros,
calcula \`VisualizerPath[]\` em coordenadas normalizadas; nao conhece Canvas.

\`VisualizerComponent\`: converte coordenadas normalizadas em pixels; trata
resize/DPR, cancelamento de \`requestAnimationFrame\`, troca de preset,
visibilidade da pagina, prefers-reduced-motion e destruicao.

\`HomeComponent\`: passa o estado \`isPlaying\` e disponibiliza seletor.

## Novo preset

Copie uma entrada de \`VISUALIZER_PRESETS\`, altere \`id\` (unico), \`name\` e
os parametros. Nao e necessario criar outro componente Canvas.

## Limites

O YouTube Player usa iframe. Nao ha acesso a FFT/amostras do audio do
YouTube pela API do iframe; os efeitos sao proceduralmente simulados.
Nao confundir o visualizador com um analisador real de frequencias.
A primeira versao pausa o tempo visual quando o player nao reproduz.

## Testes locais

\`\`\`bash
npm ci
npm run build
npx ng test --watch=false --include=src/app/services/visualizer.service.spec.ts
npm run test:radio
\`\`\`

Nenhum deploy e realizado por esta entrega.
