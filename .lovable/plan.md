# Offline completo com sincronização

## O que você terá no final

- App instalável na tela inicial (Android e iPhone), abre em tela cheia.
- Funciona **100% sem internet**: criar, editar, excluir e marcar lançamentos como pagos, gerenciar cartões e categorias — tudo local.
- Quando voltar a ter internet, o app **sincroniza automaticamente** com o Lovable Cloud em segundo plano.
- Indicador visual de status: "Online", "Offline" e "Sincronizando".

## Arquitetura

```text
┌─────────────────────────────────────────┐
│  UI (React)                             │
│   ↕ lê/escreve sempre no cache local    │
├─────────────────────────────────────────┤
│  IndexedDB (Dexie.js)                   │
│   • transactions, cards, categories…    │
│   • outbox: fila de mudanças pendentes  │
├─────────────────────────────────────────┤
│  Sync Engine                            │
│   • Pull: baixa novidades do servidor   │
│   • Push: envia outbox quando online    │
│   • Resolução: "última escrita vence"   │
├─────────────────────────────────────────┤
│  Lovable Cloud (Supabase)               │
└─────────────────────────────────────────┘
```

## Etapas

### 1. PWA instalável
- Adicionar `vite-plugin-pwa` com manifest, ícones e service worker.
- Registrar SW só em produção (não no preview do editor).
- Tela "Instalar app" com instruções para Android/iPhone.

### 2. Camada de dados local (IndexedDB via Dexie)
- Criar `src/lib/db.ts` com tabelas espelhando o Cloud: `transactions`, `user_credit_cards`, `user_categories`, `user_dashboard_fields`.
- Tabela extra `outbox` com operações pendentes (`{op: 'insert'|'update'|'delete', table, payload, timestamp}`).
- Adicionar coluna `updated_at` no banco para resolver conflitos.

### 3. Refatorar hooks (`useTransactions`, etc.)
- Trocar leituras/escritas do Supabase por leituras/escritas no Dexie.
- Cada mutação grava local **e** enfileira no outbox.
- UI fica instantânea (optimistic by default).

### 4. Motor de sincronização
- **Pull**: ao abrir o app online, baixa registros mais novos que o último sync.
- **Push**: processa outbox em ordem; em caso de erro, mantém na fila e tenta de novo.
- Trigger: ao ficar online (`window.addEventListener('online')`), a cada X minutos, e ao abrir o app.
- Resolução de conflito: o registro com `updated_at` mais recente vence.

### 5. Indicador de status
- Badge no header mostrando: 🟢 Online · 🟡 Sincronizando · 🔴 Offline (N pendentes).

### 6. Migração do banco
- Adicionar `updated_at TIMESTAMPTZ` em `transactions`, `user_credit_cards`, `user_categories`, `user_dashboard_fields` com trigger.

## Pontos de atenção

- **Login Google offline**: o login inicial **exige internet**. Depois, a sessão fica em cache e o app abre offline normalmente.
- **Importar fatura PDF**: continua exigindo internet (usa IA no servidor).
- **Sincronização com Google Sheets**: idem, só roda online.
- **Preview do editor Lovable**: o service worker fica desativado aqui para não atrapalhar o desenvolvimento. Funcionalidade offline real só na URL publicada.
- **Tamanho do esforço**: é uma reescrita significativa da camada de dados. Vou em etapas e te mostro cada parte funcionando antes de seguir.

## Ordem de entrega sugerida

1. PWA instalável + indicador online/offline (rápido, valor imediato).
2. Migração `updated_at` no banco.
3. Cache local com Dexie + leitura offline (já consegue **abrir e ver** dados sem internet).
4. Outbox + escrita offline + sincronização.

Posso começar pela etapa 1 e ir avançando, ou você prefere outra ordem?
