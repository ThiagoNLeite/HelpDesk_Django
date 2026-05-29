# 📋 HelpDesk TI — Sistema Analítico de Chamados

> **Disciplina:** Banco de Dados 2 — Projeto Prático  
> **Projeto:** Projeto 6 — Sistema de Auditoria de TI (Helpdesk Analítico)  
> **Padrão Arquitetural:** CQRS (Command Query Responsibility Segregation)  
> **Alunos:** Thiago / Bruno / Vinicius / Sthevan 

---

## 📌 Visão Geral

O HelpDesk TI é um sistema de abertura e gerenciamento de chamados técnicos para a equipe de infraestrutura de uma instituição de ensino. O sistema foi construído sobre uma arquitetura de **banco de dados distribuído**, separando fisicamente as responsabilidades de escrita e leitura em dois bancos relacionais distintos, com autenticação centralizada via Firebase.

---

## 🏗️ Arquitetura de Bancos de Dados Distribuídos

```
┌─────────────────────────────────────────────────────────────────────┐
│                       FRONTEND — React + Vite                        │
│         Login │ Registro │ Dashboard Analítico │ Gestão de Chamados  │
└────────────────────────────┬────────────────────────────────────────┘
                             │ HTTP REST (JWT no header Authorization)
┌────────────────────────────▼────────────────────────────────────────┐
│                      BACKEND — Django (Python)                       │
│                                                                      │
│  ┌─────────────────────┐        ┌──────────────────────────────┐    │
│  │  FirebaseMiddleware  │        │        CQRSRouter             │    │
│  │  Valida JWT em toda  │        │  Roteia queries para o banco  │    │
│  │  escrita (POST/PUT/  │        │  correto automaticamente      │    │
│  │  DELETE)             │        │                              │    │
│  └─────────────────────┘        └──────────────────────────────┘    │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │        Sincronização SQL Server ──────────────→ SQLite        │   │
│  │   Signals (post_save/post_delete) + recarga total no startup  │   │
│  └──────────────────────────────────────────────────────────────┘   │
└───────┬───────────────────────────┬─────────────────────┬───────────┘
        │                           │                      │
   ┌────▼────┐                ┌─────▼──────┐        ┌─────▼──────┐
   │ Banco 1 │                │  Banco 2   │        │  Banco 3   │
   │Firebase │                │ SQL Server │        │   SQLite   │
   │  Auth   │                │  (Escrita) │        │  (Leitura) │
   │  NoSQL  │                │   CRUD     │        │ DataWareh. │
   └─────────┘                └────────────┘        └────────────┘
  Autenticação              Operações do            Relatórios e
  de usuários               dia a dia               Dashboards
```

---

## 🗄️ Os Três Bancos de Dados

### Banco 1 — Firebase Authentication (NoSQL, Nuvem)

**Tecnologia:** Firebase Auth / Firestore (Google)  
**Função:** Autenticação e gerenciamento de identidade de usuários

O Firebase é o único ponto de entrada autenticado do sistema. Ao fazer login, ele emite um **JWT (JSON Web Token)** assinado digitalmente pelo Google. Esse token é enviado em todas as requisições de escrita no header `Authorization: Bearer <token>` e validado pelo backend Django antes de qualquer operação ser executada.

**Por que Firebase Auth?**
- Gerenciamento seguro de senhas sem custo de implementação
- JWT emitido e assinado pela Google — impossível falsificar
- SDK client-side maduro para React
- Gratuito na escala do projeto
- Elimina a necessidade de implementar fluxo de autenticação próprio

---

### Banco 2 — SQL Server (Relacional, Escrita/Transacional)

**Tecnologia:** Microsoft SQL Server  
**Função:** Banco transacional — recebe 100% das operações de escrita (INSERT, UPDATE, DELETE)  
**Tabelas:** `usuarios`, `chamados`

É o banco **operacional** do dia a dia. Toda criação de chamado, alteração de status e registro de usuário passa exclusivamente por ele. Garante consistência transacional (ACID) para as operações críticas.

**Por que SQL Server?**
- ACID completo — garante que nenhuma operação fica "pela metade"
- Amplamente utilizado em ambientes corporativos e institucionais
- Suporte robusto a transações concorrentes
- Integração nativa via driver ODBC com Django (`mssql-django`)

**Fluxo de Escrita:**
```
Usuário preenche formulário
        ↓
React envia POST com token Firebase
        ↓
Django valida JWT (FirebaseMiddleware)
        ↓
View cria/atualiza no SQL Server
        ↓
Signal post_save dispara automaticamente
        ↓
SQLite é atualizado (sincronização)
```

---

### Banco 3 — SQLite (Relacional, Leitura/Data Warehouse)

**Tecnologia:** SQLite  
**Função:** Banco de leitura otimizado — alimenta dashboards e relatórios gerenciais  
**Tabela:** `dashboard_chamados` (desnormalizada)

É um banco **somente leitura** do ponto de vista da aplicação. Armazena os dados consolidados e desnormalizados do banco transacional, otimizados para consultas analíticas rápidas. O Dashboard da aplicação busca seus dados exclusivamente deste banco, sem jamais tocar o SQL Server em operações de leitura do painel.

**Por que SQLite para leitura?**
- Leituras extremamente rápidas — banco embarcado, sem overhead de rede
- Tabela desnormalizada: uma única query traz todos os dados do dashboard
- Sem custo de servidor — arquivo local
- Ideal para ambientes acadêmicos e de prototipagem
- Isolamento perfeito: relatórios nunca concorrem com operações transacionais

**Estrutura da tabela desnormalizada:**
```sql
CREATE TABLE dashboard_chamados (
    id              INTEGER PRIMARY KEY,
    titulo          VARCHAR(150) NOT NULL,
    status_atual    VARCHAR(60)  NOT NULL,  -- 'Aberto', 'Em andamento', 'Fechado'
    categoria       VARCHAR(100),           -- copiada do SQL Server (fonte única)
    tempo_resolucao VARCHAR(100),           -- calculado: data_fim - data_abertura
    data            DATE                    -- data de abertura do chamado
);
```

> **Nota sobre `categoria` e `tempo_resolucao`:** a categoria é gravada no SQL Server (Banco 2) no momento da abertura do chamado e copiada para o SQLite na sincronização — o SQL Server é a fonte única da verdade. O `tempo_resolucao` é derivado: quando um chamado muda para "Fechado", o SQL Server registra `data_fim`, e a diferença `data_fim - data_abertura` é convertida em um texto legível (ex: "2.5 h", "3.0 dias") durante a sincronização.

---

## ⚡ Método de Sincronização

A sincronização entre o Banco 2 (SQL Server) e o Banco 3 (SQLite) usa **dois mecanismos complementares**, ambos implementados na própria aplicação Django:

1. **Sincronização incremental — Django Signals (`post_save` / `post_delete`):** mantém o SQLite atualizado em tempo real a cada chamado criado, alterado ou removido.
2. **Recarga total no startup — `management command` (`sync_leitura`):** sempre que o backend é iniciado, o SQLite é truncado e recarregado integralmente a partir do SQL Server, garantindo que os dois bancos partem sempre de um estado idêntico.

### 1. Sincronização incremental (tempo real)

```python
# core/signals.py

@receiver(post_save, sender=Chamado)
def atualizar_leitura(sender, instance, created, **kwargs):
    try:
        DashboardChamados.objects.using('leitura').update_or_create(
            id=instance.id,                       # mesmo id do SQL Server (1:1)
            defaults={
                'titulo': instance.titulo,
                'status_atual': instance.status,
                'categoria': instance.categoria,  # copiada do SQL Server
                'tempo_resolucao': tempo_resolucao(
                    instance.data_abertura, instance.data_fim, instance.status
                ),
                'data': instance.data_abertura.date(),
            },
        )
    except Exception as e:
        # Falha na sincronização NÃO interrompe a operação principal
        print(f"[SIGNAL WARNING] Falha ao sincronizar {instance.id}: {e}")
```

O uso de `update_or_create` com o mesmo `id` do SQL Server garante o alinhamento 1:1 entre os bancos — essencial para que `UPDATE` e `DELETE` por id funcionem nos dois lados. Um segundo signal (`post_delete`) remove o registro do SQLite quando o chamado é apagado.

### 2. Recarga total no startup (`sync_leitura`)

```python
# core/management/commands/sync_leitura.py (resumido)

class Command(BaseCommand):
    def handle(self, *args, **options):
        # 1. SQL Server está acessível? (timeout curto evita travar o startup)
        try:
            connections['default'].ensure_connection()
        except Exception:
            return  # SQL Server fora → preserva o SQLite, não toca em nada

        # 2. Lê todos os chamados do SQL Server (com categoria e data_fim)
        chamados = list(Chamado.objects.using('default').order_by('id').values(...))

        # 3. TRUNCATE no SQLite + recarga preservando os ids
        DashboardChamados.objects.using('leitura').all().delete()
        DashboardChamados.objects.using('leitura').bulk_create([...])
```

O comando é disparado automaticamente no `apps.py` quando o servidor sobe:

```python
# core/apps.py
def ready(self):
    import core.signals  # registra os signals
    if 'runserver' in sys.argv and os.environ.get('RUN_MAIN') == 'true':
        call_command('sync_leitura', quiet=True)  # recarga total
```

> **Por que recarregar tudo no startup?** Em um ambiente CQRS, os bancos podem divergir após uma queda (ex: o SQL Server recebeu chamados enquanto o SQLite estava fora). A recarga total no boot garante que o banco de leitura sempre começa fiel ao transacional, sem intervenção manual. Se o SQL Server estiver fora no momento do boot, a recarga é abortada com segurança e o SQLite antigo é preservado.

### Fluxo de sincronização incremental, passo a passo

```
1. Usuário abre chamado no frontend
          ↓
2. React envia POST /api/chamados/ com token Firebase
          ↓
3. Django valida o token (FirebaseMiddleware)
          ↓
4. View cria o Chamado no SQL Server (Banco 2)
          ↓
5. Django dispara automaticamente: post_save → atualizar_leitura()
          ↓
6. Signal espelha o registro no SQLite (Banco 3), mesmo id
          ↓
7. Dashboard já pode ler os novos dados do SQLite
```

O mesmo fluxo ocorre ao **atualizar o status**: o `Chamado.save()` dispara o signal, que atualiza `status_atual` (e recalcula `tempo_resolucao` quando o chamado é fechado).

---

## ⏱️ Latência e Consistência Eventual

### Latência medida

| Operação | Banco escrito | Sincronização para SQLite | Latência total |
|----------|---------------|--------------------------|----------------|
| Criar chamado | SQL Server | Imediata (mesma thread) | < 50ms |
| Atualizar status | SQL Server | Imediata (mesma thread) | < 50ms |
| Excluir chamado | SQL Server | Imediata (mesma chamada de view) | < 50ms |
| Recarga total (startup) | — | Lote único (`bulk_create`) | proporcional ao volume |

### Por que a latência é praticamente zero

A sincronização via Django Signals acontece **de forma síncrona, na mesma thread da requisição HTTP**. Isso significa que quando o Django retorna o `201 Created` para o frontend, o dado **já está nos dois bancos**. 

Na prática, o sistema implementa uma forma de **consistência forte** (e não apenas eventual), porque:
- O signal é disparado dentro da mesma transação da requisição
- Não há fila, scheduler ou processo separado
- O cliente nunca recebe resposta antes da sincronização terminar

A terminologia "Consistência Eventual" se aplica ao **modelo arquitetural** (os bancos são separados e poderiam divergir em caso de falha), mas não à latência observada em condições normais.

### Justificativa da latência para o domínio do projeto

Para um sistema de helpdesk institucional, uma latência de sincronização inferior a 50ms é **mais do que adequada**. Comparando com alternativas:

| Mecanismo | Latência típica | Complexidade | Escolhido? |
|-----------|----------------|--------------|------------|
| **Django Signals (nossa escolha)** | **< 50ms** | **Baixa** | **✅ Sim** |
| CRON Job (a cada 1 min) | 30s a 60s | Baixa | ❌ |
| Trigger SQL Server | < 10ms | Alta (DBA) | ❌ |
| RabbitMQ / Kafka | 100ms a 2s | Muito alta | ❌ |
| Polling na API | 1s a 30s | Média | ❌ |

---

## 🔄 CQRS Router — Roteamento Automático de Queries

O `CQRSRouter` em `core/routers.py` instrui o Django ORM a enviar cada query para o banco correto, de forma transparente para as views:

```python
class CQRSRouter:
    def db_for_read(self, model, **hints):
        # Leituras do dashboard → SQLite
        if model._meta.model_name == 'dashboardchamados':
            return 'leitura'
        # Leituras de usuários e chamados → SQL Server
        return 'default'

    def db_for_write(self, model, **hints):
        # Escritas do dashboard (via signal) → SQLite
        if model._meta.model_name == 'dashboardchamados':
            return 'leitura'
        # Todas as demais escritas → SQL Server
        return 'default'
```

Com isso, as views não precisam especificar qual banco usar — o router decide automaticamente.

---

## 🛡️ Tolerância a Falhas (Fallback)

A aplicação implementa degradação graciosa em caso de falha de um dos bancos. O comportamento difere entre a **lista de chamados** e o **dashboard analítico**, por decisão de projeto.

### Cenário A — SQLite (Banco 3 / Leitura) cai

| Funcionalidade | Comportamento |
|----------------|---------------|
| Login via Firebase | ✅ Continua funcionando (banco independente) |
| Criação/edição de chamados | ✅ Continua funcionando (escreve no SQL Server) |
| Lista de chamados (`GET /api/chamados/`) | ⚠️ Faz **fallback** para o SQL Server, com aviso de modo degradado |
| Dashboard analítico (`GET /api/dashboard/stats/`) | ❌ **Não faz fallback** — retorna `503` e o frontend exibe uma tela limpa de "Painel indisponível" |

```python
# views.py — dashboard_stats()
try:
    qs = DashboardChamados.objects.using('leitura')   # SQLite
    # ... monta as métricas ...
except Exception:
    return JsonResponse(
        {'error': 'Banco de leitura (SQLite) indisponível.', 'leitura_offline': True},
        status=503
    )
```

> **Por que o dashboard não faz fallback?** O painel analítico é, por definição, a responsabilidade exclusiva do banco de leitura (CQRS). Servir o dashboard a partir do banco transacional anularia o propósito da separação e poderia sobrecarregar o SQL Server justamente num momento de instabilidade. A escolha de exibir uma mensagem clara, em vez de mascarar a falha, deixa o comportamento do sistema explícito durante o teste de resiliência.

### Cenário B — SQL Server (Banco 2 / Escrita) cai

| Funcionalidade | Comportamento |
|----------------|---------------|
| Login via Firebase | ✅ Continua funcionando (banco independente) |
| Dashboard e lista | ✅ Continuam funcionando (dados do SQLite) |
| Criação/atualização/exclusão de chamados | ❌ Desabilitada, com mensagem clara `503` ("Banco de escrita indisponível") |

Para que o **startup do servidor não trave** quando o SQL Server está fora, o driver ODBC é configurado com timeout curto de login (`LoginTimeout=3`). Sem isso, o Django ficaria pendurado aguardando o timeout padrão e o sistema parecia "não iniciar". Com o timeout curto, a conexão falha rápido, a recarga de startup é abortada com segurança e o sistema sobe normalmente lendo do SQLite.

```python
# settings.py — OPTIONS do SQL Server
'extra_params': 'TrustServerCertificate=yes;LoginTimeout=3;',
'connection_timeout': 3,
```

---

## 📁 Estrutura do Projeto

```
setup_helpdesk/
├── core/
│   ├── models.py          # Modelos: Usuario, Chamado (SQL Server) e DashboardChamados (SQLite)
│   ├── views.py           # Endpoints da API REST
│   ├── signals.py         # ⭐ Sincronização incremental SQL Server → SQLite (post_save/post_delete)
│   ├── routers.py         # CQRS Router — roteamento automático de queries
│   ├── middleware.py      # Validação do token Firebase em todas as escritas
│   ├── firebase_config.py # Inicialização do Firebase Admin SDK
│   ├── apps.py            # Registro dos signals + recarga total no startup
│   └── management/
│       └── commands/
│           └── sync_leitura.py  # ⭐ Recarga total SQL Server → SQLite (truncate + reload)
│
├── setup_helpdesk/
│   ├── settings.py        # Configuração dos 3 bancos + CORS + DATABASE_ROUTERS
│   └── urls.py            # Mapeamento de todos os endpoints
│
├── helpdesk_frontend/     # Aplicação React
│   └── src/
│       ├── firebase.js    # Configuração do Firebase (web SDK)
│       ├── AuthContext.jsx # Gerenciamento de autenticação global
│       ├── api.js         # Centralização das chamadas HTTP
│       └── pages/
│           ├── Login.jsx
│           ├── Register.jsx
│           ├── Dashboard.jsx      # Gráficos e KPIs (lê do SQLite)
│           ├── Chamados.jsx       # Listagem com filtros (lê do SQLite)
│           └── NovoChamado.jsx    # Formulário de abertura (escreve no SQL Server)
│
├── firebase-key.json      # Credencial do Firebase Admin SDK (backend)
├── db_leitura.sqlite3     # Banco de Leitura (Banco 3)
└── manage.py
```

---

## 🔌 Endpoints da API

| Método | Rota | Auth | Banco lido/escrito | Descrição |
|--------|------|------|--------------------|-----------|
| `POST` | `/api/auth/register/` | ✅ Firebase | SQL Server (escrita) | Registra perfil do usuário |
| `GET` | `/api/usuarios/me/` | ✅ Firebase | SQL Server (leitura) | Retorna perfil do usuário autenticado |
| `GET` | `/api/chamados/` | ❌ | SQLite → fallback SQL Server | Lista todos os chamados |
| `POST` | `/api/chamados/` | ✅ Firebase | SQL Server + sync SQLite | Cria novo chamado |
| `GET` | `/api/chamados/<id>/` | ❌ | SQL Server | Detalhe de um chamado |
| `PUT` | `/api/chamados/<id>/` | ✅ Firebase | SQL Server + sync SQLite | Atualiza status |
| `DELETE` | `/api/chamados/<id>/` | ✅ Firebase | SQL Server + SQLite | Remove chamado |
| `GET` | `/api/dashboard/stats/` | ❌ | SQLite (sem fallback → 503 se cair) | Métricas analíticas |

---

## ▶️ Como executar o projeto

### Pré-requisitos
- Python 3.11+
- Node.js 18+
- SQL Server com banco `HelpDesk` criado e usuário `django_user` configurado
- Conta Firebase com projeto `sistema-de-auditoria-de-ti`

### Backend (Django)

```bash
# Na pasta setup_helpdesk/
.\env\Scripts\activate          # Windows
source env/bin/activate         # Linux/Mac

# Cria/atualiza as tabelas. As migrations já incluem as colunas
# 'categoria' e 'data_fim' na tabela chamados (SQL Server).
python manage.py migrate --database=default   # SQL Server
python manage.py migrate --database=leitura   # SQLite

python manage.py runserver 8000
# No startup, o SQLite é recarregado automaticamente a partir do SQL Server.
```

> **Alternativa para as colunas novas:** se preferir não rodar migrate no SQL Server (por já ter dados em produção), o script `alterar_sql_server.sql` adiciona `categoria` e `data_fim` à tabela `chamados` de forma idempotente.
>
> **Recarga manual:** a sincronização total roda sozinha no `runserver`, mas também pode ser disparada a qualquer momento com `python manage.py sync_leitura`.

### Frontend (React)

```bash
# Na pasta setup_helpdesk/helpdesk_frontend/
npm install --legacy-peer-deps
npm run dev
# Acesse: http://localhost:3000
```

> O Vite está configurado com proxy: chamadas para `/api` são redirecionadas automaticamente para `http://localhost:8000`.

---

## 💡 Por que Django Signals e não outras alternativas?

### Escolhido: Django Signals

Os signals oferecem o melhor equilíbrio para este contexto:

1. **Zero infraestrutura adicional** — funciona dentro do próprio processo Django
2. **Latência praticamente zero** — síncrono na mesma thread da requisição
3. **Código versionado junto com a aplicação** — fácil de auditar e testar
4. **Tolerante a falhas** — um erro no signal não derruba a operação principal (try/except)
5. **Idiomático no ecossistema Django** — padrão bem documentado e amplamente usado

O mecanismo de signal é ativado automaticamente no startup via `apps.py` e não requer nenhuma configuração externa. Ele é complementado pela **recarga total no startup** (`sync_leitura`), que garante que o banco de leitura sempre parte de um estado fiel ao transacional — mesmo após uma queda em que os bancos tenham divergido. Juntos, os dois mecanismos tornam o projeto completamente autocontido e fácil de executar em qualquer ambiente de desenvolvimento.