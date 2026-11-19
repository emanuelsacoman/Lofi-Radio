# Visualizer Studio: catálogo do Firebase

O editor fica em `/adm#visualizer-studio`. Escolha um estilo, ajuste as cores e
os controles e use **Salvar visualizer**. Com **Disponível no player** desligado,
a criação fica como rascunho privado; ao ligar e salvar, ela aparece no seletor
do player em tempo real. A biblioteca permite buscar, editar, duplicar e excluir.
A prévia usa o mesmo renderer do player com sinal de demonstração, sem capturar
áudio nem alterar a seleção do ouvinte. Alterações não salvas têm proteção ao
sair, e falhas de gravação preservam o formulário para uma nova tentativa.

As criações do admin ficam na coleção Firestore `visualizers`. Cada documento
armazena nome, descrição, ícone, publicação (`enabled`) e todos os parâmetros de
`VisualizerConfig`. O ID é gerado pelo Firestore. `createdAt` e `updatedAt` usam o
relógio do servidor; alterações preservam a data de criação.

`VisualizerCatalogService.watchAll()` observa a biblioteca do admin em tempo
real. `watchPublished()` consulta `enabled == true`, permitindo que o player
carregue apenas as criações publicadas. Não existe catálogo local nem presets
automáticos no player: com o banco vazio, nenhum visualizer fica disponível.
Os estilos iniciais do editor são somente ferramentas para criar um novo
documento; eles só entram no player depois de salvos e publicados no Firebase.

As personalizações adicionais são persistidas no mesmo documento:

| Grupo | Campos | Limites |
| --- | --- | --- |
| Composição | `scale`, `positionX`, `positionY`, `angle`, `mirrorX` | Escala 0,25–2; posição ±50% da área; ângulo ±180°; espelhamento horizontal |
| Cores | `colorMode` | Cores por camada, gradiente ou cor única |
| Ondas | `waveShape`, `veilOpacity` | Senoidal, triangular ou dente de serra; cortinas 0–1 |
| Equalizador | `barLayout`, `barGap` | Base inferior, centro ou topo; espaço entre barras 0,1–0,9 |
| Vaga-lumes | `particleCount`, `particleSize`, `particleSpread`, `twinkleSpeed` | 4–96 luzes; tamanho 0,5–3; dispersão 0,25–1,5; velocidade de brilho 0,25–3 |

Documentos anteriores sem esses campos continuam funcionando: a leitura aplica
os valores de `VISUALIZER_CUSTOMIZATION_DEFAULTS`, preservando a composição
original. Na próxima gravação, todos os campos são enviados ao Firestore.
Valores presentes mas inválidos são rejeitados; não há migração automática nem
criação de documentos durante a leitura.

As regras de `firestore.rules` restringem criação, edição, exclusão e leitura de
rascunhos ao mesmo UID autorizado a gerenciar `siteThemes`. Visitantes podem
ler apenas documentos publicados. As regras validam campos, limites numéricos,
cores e timestamps; nenhuma mudança de outros catálogos é necessária.

Antes de utilizar o Studio no ambiente hospedado, publique as regras deste
checkout no projeto Firebase já configurado:

```sh
firebase deploy --only firestore:rules
```

Não é necessário índice composto: a consulta filtra apenas `enabled`, e a
ordenação por nome acontece no cliente. Erros de permissão, rede ou gravação
são propagados ao editor, para que o resultado não seja anunciado como salvo
antes da confirmação do Firestore.

Validação local:

```sh
npm run build
npm run test:visualizers
```

A suíte de visualizers cobre catálogo, editor, renderer, motor e captura de áudio.
