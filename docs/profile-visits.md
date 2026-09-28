# Visitas no admin

O componente standalone `ProfileVisitsChartComponent` mostra o histórico real de
acessos do Lofi Radio, em SVG, com filtros de 7, 14 e 30 dias. Os pontos podem ser
selecionados por mouse, teclado ou toque; os valores também estão em uma tabela.

## Integração com o Firebase existente

O projeto `lofi-radio-d03a7` já possui a callable Cloud Function `registerVisit`
em `us-central1`. A home chama essa função via `AngularFireFunctions`. A função
valida o pedido, deduplica `sessionId` e grava os contadores com uma transação
no servidor. O cliente não grava diretamente no Firestore.

O painel lê `analytics_daily/{YYYY-MM-DD}/analyticsDailyShards`, somando o campo
`visits` de cada shard. São observadas somente as 30 subcoleções diárias do
intervalo, com no máximo 16 shards por dia no backend atual. Isso usa as regras
publicadas e dispensa novos índices de collection group. Os listeners são
liberados ao sair do painel e o intervalo é renovado na virada do dia UTC.

As regras atuais permitem leitura dos shards apenas para usuários autenticados
no admin. Elas bloqueiam gravações diretas e qualquer acesso à coleção
`profileVisits`, usada equivocadamente na primeira implementação deste gráfico.
A integração corrigida não usa essa coleção e não exige publicar novas regras.

## O que é contado

- A visita é registrada na entrada da **home**, inclusive pelo localhost. Entrar
  diretamente no admin apenas consulta o histórico.
- O ID aleatório do navegador fica em `lofi.profileVisitorId`. O `sessionId`
  enviado combina esse ID com a data UTC, evitando repetir a contagem do mesmo
  navegador no dia, mesmo em novas abas ou após um retry.
- A data UTC acompanha o formato usado pelo servidor. O agrupamento diário não
  é convertido para o fuso local do navegador.
- `lofi.analyticsVisitTrackedDate` evita chamadas já concluídas no dia. O cache
  antigo `lofi.profileVisitTrackedDate` não suprime o registro corrigido.
- O backend já armazena visitas por sessão; por isso os totais são apresentados
  como **visitas**, sem prometer pessoas distintas. O histórico anterior é mantido.
- Outro navegador, dispositivo ou limpeza do armazenamento cria outra identidade.
  Com armazenamento bloqueado, a identidade só dura enquanto a aplicação está aberta.
- A função publicada também realiza sua lógica existente de localização aproximada
  e presença. O gráfico lê apenas os contadores diários, sem consultar esses detalhes.

## Diagnóstico

Falhas de leitura aparecem no painel; `permission-denied` informa especificamente
que o Firebase negou acesso, e `unauthenticated` orienta entrar novamente. Falhas
de registro não interrompem a rádio, mas deixam o código do erro no console com
o prefixo `[Visitas]`. Uma nova entrada na home tenta registrar novamente.

`npm run test:visits` verifica o contrato da callable, repetição de acessos,
retry, leitura e soma dos shards, datas UTC, filtros, estados e interações.
