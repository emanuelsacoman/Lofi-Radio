# Monitor de visitas

O monitor combina Cloud Functions, Cloud Firestore e Realtime Database para manter o painel administrativo rápido mesmo quando o histórico crescer.

## Fluxo dos dados

1. A `HomeComponent` inicia uma sessão no `VisitorTrackingService`.
2. A callable Function `registerVisit` valida o payload e usa o IP apenas em memória para buscar uma localização aproximada. O IP não é gravado.
3. Uma visita por sessão é salva em `analytics_visits`. O documento recebe `expiresAt` para retenção automática de 90 dias.
4. O total diário é distribuído entre 16 documentos em `analytics_daily/{AAAA-MM-DD}/analyticsDailyShards`, evitando um único contador muito disputado.
5. A presença fica em `visitorAnalytics/live/{connectionId}` no Realtime Database. `onDisconnect` remove a conexão e um heartbeat evita registros órfãos.
6. Triggers mantêm `analyticsPublic/onlineCount`, de modo que o site público lê somente um número, não a lista de visitantes.
7. O admin combina presença, agregados e os 30 acessos mais recentes no `VisitorAnalyticsService`.

## Segurança e privacidade

- Coordenadas são arredondadas para uma casa decimal e representam uma região aproximada, não GPS.
- IP bruto e user-agent completo não são persistidos.
- O histórico expira em 90 dias por TTL do Firestore.
- Histórico, agregados e localização online só podem ser lidos por um usuário Firebase autenticado.
- As regras seguem o login fechado já existente. Antes de habilitar cadastro público ou autenticação anônima, adicione a custom claim `admin: true` ao usuário administrativo e exija essa claim no `AuthGuard`, em `firestore.rules` e em `database.rules.json`.
- Informe essa coleta e sua finalidade na política de privacidade do site, conforme a base legal aplicável.

O endpoint gratuito do IPWho não exige chave, mas possui limite compartilhado e não oferece SLA. Para tráfego de produção, troque `functions/src/analytics/geoip.ts` por um plano/provedor contratado e configure App Check no aplicativo e `enforceAppCheck` na callable Function.

## Implantação

Cloud Functions de 2ª geração e a tarefa agendada de limpeza exigem que o projeto Firebase esteja no plano Blaze.

```bash
npm --prefix functions install
npm run build
npm --prefix functions run build
firebase deploy --only firestore:rules,firestore:indexes,database,functions,hosting
```

O arquivo `firestore.indexes.json` habilita TTL no campo `expiresAt`. O primeiro deploy pode levar alguns minutos para criar a política.

## Estrutura principal

```text
Firestore
├── analytics_visits/{sessionId}
└── analytics_daily/{date}/analyticsDailyShards/{00..15}

Realtime Database
├── analyticsPublic/onlineCount
└── visitorAnalytics/live/{connectionId}
```

O gráfico sempre gera uma janela UTC contínua de 30 dias, preenchendo dias sem acesso com zero. O mapa mostra somente presenças com heartbeat recente e agrupa pontos próximos para continuar legível.
