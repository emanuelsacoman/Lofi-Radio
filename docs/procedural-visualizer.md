# Lofi Radio — Visualizador procedural

Branch: `feature/chatgpt-visualizer` (versão experimental gerada pelo ChatGPT).

## Arquivos essenciais

- `src/app/services/visualizer.service.ts`: estado e cálculos matemáticos.
- `src/app/services/visualizer-presets.ts`: presets e cores configuráveis.
- `src/app/services/interfaces/visualizer/visualizerconfig.ts`: contratos TypeScript.
- `src/app/view/effect/visualizer/visualizer.component.ts`: renderização Canvas 2D.

### Se o build mostrar `Cannot find module './visualizer-presets'`

O arquivo de presets está versionado nesta branch. Se não estiver no seu
computador, confira a branch ativa e restaure o arquivo a partir do remoto:

```bash
git status --short
git fetch origin
git switch feature/chatgpt-visualizer
git pull --ff-only origin feature/chatgpt-visualizer
git restore --source=origin/feature/chatgpt-visualizer -- src/app/services/visualizer-presets.ts
npm run build
```

O `git restore` acima substitui **somente** a cópia local do arquivo informado.
Se você já tiver edições locais nesse arquivo, faça backup antes do restore.
Não use `git reset --hard` para corrigir a ausência de um único arquivo.

## Ajustando os visuais

Edite `VISUALIZER_PRESETS` no arquivo `visualizer-presets.ts`.
Cada objeto define geometria (`wave`, `circle`, `spiral`, `bars`, `lissajous`),
amplitude, frequência, velocidade, harmônicos, fase, camadas, resolução,
espessura, brilho, opacidade e cores (`theme`, `accent` ou hexadecimal).

A seleção é persistida em `localStorage` na chave
`lofi.visualizer.preset.v1`; a opção `Off` interrompe a renderização.

## Limitações

O player usa o iframe do YouTube, que não disponibiliza amostras brutas ou FFT.
Os padrões desta versão são simulados, **não** sincronizados à batida real.

## Verificações

```bash
npm run build
npx ng test --watch=false --include=src/app/services/visualizer.service.spec.ts
npm run test:radio
```

Nenhum deploy é realizado por esta entrega.
