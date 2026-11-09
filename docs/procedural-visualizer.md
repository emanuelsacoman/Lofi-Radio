# Lofi Radio — Visualizador com áudio real

Branch: feature/chatgpt-visualizer

## O que mudou

O visualizador agora pode reagir ao áudio REAL da live selecionada:
- Captura da aba com permissão explícita do usuário (getDisplayMedia)
- Web Audio AnalyserNode: FFT, intensidade RMS, graves, médios, agudos
- Detector adaptativo de batidas a partir de transientes de graves (estimativa)
- 64 bandas espectrais para barras e energia para as outras geometrias
- Cores herdadas dinamicamente do tema selecionado (sem hex fixo nos presets)
- Um único canvas e um único loop. Sem áudio detectável, o canvas fica transparente.

## Ativação no navegador

1. Abra o Lofi Radio em localhost ou HTTPS.
2. Inicie uma live no player YouTube.
3. Clique no ícone **Visualizers** ao lado do ícone Palette para abrir as opções.
4. Clique no ícone de um dos três presets (incluindo Firefly Garden).
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
as três opções, o botão Off e o indicador de captura.

**A captura de áudio é solicitada somente após o usuário clicar no ícone de
um visualizador**, usando o mesmo `selectVisualizer()` já existente; a
abertura dos menus não solicita nenhuma permissão. O consentimento de captura continua independente da seleção: apenas o clique
em um preset pode pedir acesso. A lógica de silêncio continua obrigatória.

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


## V2 — Atmosferas cinematográficas (3 estilos)

| Preset | Direção de arte | O que reage ao áudio |
| --- | --- | --- |
| Waveform / Silk | Cortinas translúcidas de aurora e ondas brilhantes | Graves modulam ondulações e faixas |
| Equalizer / Sparks | Barras espectrais com pontos brilhantes nas cristas | Cada banda FFT controla sua própria altura |
| Firefly Garden | Vagalumes suaves em sprites luminosos reutilizados | Agudos acendem partículas; silêncio apaga tudo |

### Contratos preservados

- **Privacidade:** o áudio da aba continua sendo analisado localmente; nenhum stream ou dado FFT é enviado ao servidor. O pedido de permissão acontece apenas ao clicar em um efeito, e Off encerra a sessão.
- **Sem movimento falso:** não há partículas, faixas ou petalas visíveis sem atividade espectral real, mesmo que o envelope do beat ainda esteja decaindo.
- **Sem regressão dos menus:** lista de presets com identidade estável e \`trackBy\`; Palette e Visualizers continuam independentes e com tooltips.
- **Acessibilidade:** \`prefers-reduced-motion\` desativa o loop de animação, mas mostra um snapshot estático quando há áudio disponível.
- **Performance:** demais efeitos limitados a ~45 FPS e até ~4,5 MP; Firefly limitado a 24 FPS, até ~1,4 MP e somente 11 partículas no mobile ou 18 no desktop. O brilho do Firefly é pré-renderizado em sprites de 40×40 e reutilizado até que a paleta mude. Canvas 2D único, sem novas dependências.
- **Temas:** todos os efeitos utilizam tokens da paleta selecionada; não adicionam cores fixas ao catálogo.

### Validação recomendada

\`\`\`bash
npm ci
npm run build
npx ng test --watch=false --include=src/app/services/visualizer.service.spec.ts --include=src/app/view/effect/visualizer/visualizer.component.spec.ts
npm run test:radio
\`\`\`

Revisar manualmente no Chrome/Edge: alternar os três efeitos, escolher esta aba
com áudio, trocar a paleta durante a reprodução, testar Off, silêncio, tela
estreita e preferência por movimento reduzido. Nenhuma alteração de deploy.


### V2.1 — Redução de custo do Firefly Garden

Os efeitos Meteor Shower e Lotus Dream foram removidos do catálogo, renderizador e tipos.
A lista possui agora seis presets. Uma seleção antiga de qualquer preset removido
no \`localStorage\` volta para Off, sem compartilhar áudio ou selecionar outro efeito.

Antes, o Firefly renderizava até **58 círculos com \`shadowBlur\` individual por quadro**,
mais véus de aurora e duas curvas matemáticas. Agora:
- Usa somente 18 sprites no desktop ou 11 no mobile; cada sprite é renderizado apenas
  uma vez por paleta (\`createRadialGradient\`) e reutilizado com \`drawImage\`.
- Não cria curvas, véus de aurora nem sombras por partícula.
- Desenha em \`source-over\`, não \`lighter\` em toda a superfície.
- Limita a atualização a 24 FPS e o framebuffer a 1,4 MP com escala máxima de 1×.
- Mantém o mesmo mecanismo de áudio real, a mesma política de silêncio e suporte às
  cores da paleta; retorna aos limites normais de resolução nos outros efeitos.
- Libera o cache ao destruir o componente.

**Validação de performance:** confirmar FPS e CPU/GPU via Performance do DevTools em
notebook e mobile, com áudio compartilhado e em silêncio. Os limites reduzem trabalho,
mas não são uma medição de tempo real em todos os dispositivos.


### V2.2 — Catálogo simplificado

Orbit e Lissajous foram removidos dos presets, da matemática que não possuía
mais consumidores e das rotinas de desenho exclusivas. Naquela etapa restavam Waveform, Spiral, Equalizer e Firefly Garden, além de Off. Seleções antigas armazenadas para os
efeitos removidos são tratadas como Off; não iniciam captura de áudio.


### V2.3 — Firefly Garden mais reativo, sem aumentar a carga gráfica

O preset Spiral foi removido do catálogo e as rotinas exclusivas de geometria
espiral e partículas de vórtice foram eliminadas. Restam **Waveform, Equalizer
e Firefly Garden**, além de Off. Seleções antigas de Spiral são tratadas como Off.

A V2.3 experimentou aumentar tamanho e afastar partículas em batidas.
Esse comportamento de zoom foi **substituído na V2.4**, abaixo, por piscadas
assíncronas de tamanho fixo.


### V2.4 — Vagalumes naturais: pisques individuais, sem zoom

- Cada vagalume conserva seu **tamanho fixo**. O posicionamento apenas
  flutua suavemente como antes; nenhum grave nem batida expande o conjunto.
- Os 18 seeds existentes usam fases e períodos próprios (~2,4–4,6 s);
  uma luz fica apagada a maior parte do tempo, aparece brevemente com
  entrada/saída suave e alguns indivíduos exibem um segundo pisque.
- **Música real** modula o brilho da piscada, variando por graves,
  intensidade RMS, agudos, batidas e banda FFT individual. Áudio mais intenso
  gera piscadas mais vívidas e acelera discretamente o relógio, sem acender
  todas as partículas ao mesmo tempo.
- Sem sinal espectral real ou sem captura, o canvas continua apagado,
  mesmo quando o envelope de batida ainda decai.
- **Performance preservada:** sprites de brilho cacheados, 18 partículas no
  desktop / 11 mobile, 24 FPS e nenhuma sombra extra por partícula.

Testes: picos vs pausas, fase entre partículas, segundo pisque,
intensidade da música, silêncio e invariância do tamanho dos sprites.


### V2.5 — Firefly Garden / Living Lanterns

A cena foi redesenhada para transmitir um pequeno jardim vivo, não um equalizador
disfarçado de partículas:

- **Voo orgânico:** cada vaga-lume segue uma trajetória suave de duas frequências
  sobrepostas, com velocidade e fase individuais. Não há saltos, zoom nem expansão
  sincronizada em batidas.
- **Profundidade de campo:** cada inseto nasce com tamanho e luminosidade próprios;
  os mais distantes são discretos, os próximos têm brilho mais pronunciado. O
  tamanho permanece fixo durante a música.
- **Conversa luminosa:** quando um novo ataque de grave é detectado, até quatro
  vagalumes respondem em sequência, com atrasos de 150 ms. Os outros continuam
  piscando de maneira independente; nenhum pulso acende toda a cena.
- **Pisques naturais:** piscadas breves com pausas longas e ocasionais pisques
  duplos. A música altera a intensidade das luzes, sem substituir os ciclos
  individuais nem produzir iluminação quando não existe sinal real.
- **Textura refinada:** núcleo de luz claro e halo suave nas cores da paleta,
  renderizados previamente apenas quando as cores mudam.
- **Desenho econômico:** vagalumes apagados não chamam `drawImage`. A cena
  mantém 18 sementes no desktop, 11 no mobile, limite de 24 FPS e até
  1,4 MP de framebuffer. Não foram incluídas sombras Canvas por partícula,
  novos pacotes ou permissões.

Os testes cobrem determinismo e continuidade das trajetórias, intervalos de
resposta ao beat, invariância do tamanho, cache de sprites e silêncio absoluto.
Esses testes verificam comportamento; desempenho percebido e qualidade visual
devem ser conferidos no navegador com áudio real.
