# Lofi Radio ? Visualizers com ?udio real

## Cat?logo e cria??o no admin

O seletor do player mostra exclusivamente documentos publicados da cole??o
Firestore `visualizers`. N?o h? efeitos locais de reserva: se n?o houver
cria??es publicadas, o cat?logo fica vazio e a op??o **Off** continua dispon?vel.
Nomes, ?cones e par?metros v?m do mesmo documento salvo no admin.

Para criar ou personalizar uma atmosfera, abra **Visualizer Studio** em
`/adm#visualizer-studio`. Escolha um estilo, d? um nome ? cria??o, ajuste os
controles e use **Salvar visualizer**. Habilitar **Dispon?vel no player** publica
essa cria??o. O editor tamb?m permite duplicar, editar, buscar e excluir.
Os estilos oferecidos como ponto de partida n?o s?o itens do cat?logo: precisam
ser salvos e publicados para aparecer ao ouvinte.

O Studio permite ajustar:

- Composi??o: escala, posi??o horizontal/vertical, ?ngulo e espelhamento.
- Cores: paleta, cores por camada, gradiente ou cor ?nica.
- Ondas: intensidade, forma, frequ?ncia, harm?nicos, fase, camadas e cortinas.
- Equalizador: n?mero de barras, posi??o da base, espa?amento e espessura.
- Vaga-lumes: quantidade, tamanho, dispers?o, velocidade de voo e piscadas.
- Resposta ao ?udio, brilho, opacidade e defini??o, conforme o estilo.

A pr?via utiliza o mesmo motor e Canvas do player com um sinal de demonstra??o.
Ela n?o solicita compartilhamento de ?udio nem altera a sele??o do ouvinte.
Os campos s?o validados antes de salvar; erros preservam o formul?rio.
Veja os limites, compatibilidade dos documentos antigos e regras em
[Cat?logo do Firebase](visualizer-catalog.md).

## Ativa??o no navegador

1. Abra o Lofi Radio em localhost ou HTTPS e inicie uma live.
2. Abra **Visualizers**, ao lado de **Palette**.
3. Escolha uma das cria??es publicadas dispon?veis.
4. Na solicita??o do navegador, selecione **a aba do Lofi Radio** e habilite
   **Compartilhar ?udio da guia**.
5. Escolha outra cria??o para mudar o efeito ou **Off** para encerrar a captura.
6. Se a permiss?o for cancelada, escolha novamente um visualizer para tentar.

Apenas abrir o menu ou restaurar uma escolha salva n?o solicita captura.
O navegador exige uma a??o expl?cita para compartilhar a aba. A disponibilidade
 de ?udio compartilhado varia por navegador e plataforma; o fluxo ? destinado
principalmente a Chrome/Edge desktop. Compartilhar monitor, janela ou outra aba
pode n?o fornecer a faixa de ?udio esperada.

A API do iframe do YouTube n?o disponibiliza ?udio bruto para Web Audio.
A captura autorizada analisa o som reproduzido pela aba localmente: n?o usa
microfone, n?o grava e n?o envia ?udio ou dados FFT ao Firebase. O v?deo
capturado n?o ? exibido. As faixas s?o encerradas com **Off**, ao sair do player
ou quando o compartilhamento termina.

## Renderiza??o e sil?ncio

O `VisualizerAudioService` fornece intensidade RMS, graves, m?dios, agudos,
batidas e 64 bandas espectrais. O detector de batidas ? uma estimativa baseada
em transientes de graves, n?o uma identifica??o garantida de BPM.

| Estilo | Apar?ncia | Resposta ao ?udio |
| --- | --- | --- |
| Ondas | Curvas e cortinas transl?cidas | Energia espectral modula deforma??o e brilho |
| Equalizador | Barras com base inferior, central ou superior | Cada banda FFT determina sua altura |
| Vaga-lumes | Luzes com voo suave e piscadas individuais | M?sica modula o brilho; ataques de grave geram respostas escalonadas |

Na reprodu??o real, o canvas fica transparente sem atividade espectral.
Barras t?m altura zero no sil?ncio. O decaimento de uma batida isolada n?o ?
suficiente para manter efeitos vis?veis. O sinal simulado existe apenas na
pr?via explicitamente ativada do admin.

A prefer?ncia `prefers-reduced-motion` interrompe o loop e mant?m uma imagem
est?tica quando h? sinal. Anima??es tamb?m param quando a p?gina est? oculta.
O motor usa um ?nico canvas, limita os quadros e o tamanho do framebuffer e
reutiliza sprites de luz. A quantidade de vaga-lumes ? configur?vel, com um
limite de 96; seus tamanhos n?o pulsam automaticamente com as batidas.

## Sele??o, atualiza??o e menus

O cat?logo acompanha o Firebase em tempo real. Editar um visualizer publicado
atualiza sua defini??o; despublic?-lo ou exclu?-lo remove a op??o do player.
Quando a cria??o ativa deixa de existir no cat?logo, a sele??o volta para
**Off**. A prefer?ncia salva cont?m apenas o ID: nenhum visualizer antigo
embutido no c?digo ? restaurado como substituto.

Os menus Palette e Visualizers permanecem independentes, com identidade est?vel
por documento e estados acess?veis. O compartilhamento de ?udio continua
independente do carregamento do cat?logo. O indicador de captura pertence ao
navegador e permanece vis?vel durante o compartilhamento autorizado.

## Organiza??o do c?digo

- `services/visualizer-catalog.service.ts`: leitura, valida??o e grava??o no Firestore.
- `services/visualizer-customization.ts`: defaults compat?veis e limites dos controles.
- `services/visualizer.service.ts`: cat?logo publicado, sele??o e matem?tica das formas.
- `services/visualizer-audio.service.ts`: captura autorizada e extra??o de ?udio.
- `services/visualizer-presets.ts`: pontos de partida usados somente pelo editor.
- `view/adm/visualizer-studio/`: formul?rio, biblioteca e pr?via.
- `view/effect/visualizer/visualizer.component.ts`: desenho Canvas e ciclo de renderiza??o.
- `view/website/home/home.component.*`: seletor e integra??o com o player.

## Valida??o

```sh
npm run build
npm run test:visualizers
npm run test:radio
```

No navegador, conferir cria??o/edi??o/publica??o, cat?logo vazio, mudan?a de
par?metros, tela estreita e movimento reduzido. Para ?udio real, testar a aba
compartilhada, troca de visualizer, **Off**, pausa e sil?ncio da live. Os testes
automatizados verificam comportamento; a captura real precisa do consentimento
na interface do navegador.
