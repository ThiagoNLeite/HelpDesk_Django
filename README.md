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
│  │               Django Signals (post_save)                      │   │
│  │   Sincronização automática SQL Server ──────────→ SQLite      │   │
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
    categoria       VARCHAR(100),           -- ex: 'Hardware', 'Rede', 'Software'
    tempo_resolucao VARCHAR(100),           -- campo reservado para métricas futuras
    data            DATE NOT NULL           -- data de abertura do chamado
);
```

---

## ⚡ Método de Sincronização — Django Signals (post_save)

### Qual método foi escolhido

A sincronização entre o Banco 2 (SQL Server) e o Banco 3 (SQLite) é realizada via **Django Signals**, especificamente o sinal `post_save` conectado ao modelo `Chamado`.

### Como funciona na prática

```python
# core/signals.py

from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import Chamado, DashboardChamados

@receiver(post_save, sender=Chamado)
def atualizar_leitura(sender, instance, created, **kwargs):
    try:
        # Se o registro já existe no SQLite → atualiza
        obj = DashboardChamados.objects.using('leitura').get(id=instance.id)
        obj.titulo = instance.titulo
        obj.status_atual = instance.status
        obj.save(using='leitura', update_fields=['titulo', 'status_atual'])
    except DashboardChamados.DoesNotExist:
        # Se não existe → cria
        DashboardChamados.objects.using('leitura').create(
            id=instance.id,
            titulo=instance.titulo,
            status_atual=instance.status,
        )
    except Exception as e:
        # Falha na sincronização NÃO interrompe a operação principal
        print(f"[SIGNAL WARNING] Falha ao sincronizar chamado {instance.id}: {e}")
```

O signal é registrado automaticamente pelo Django no startup da aplicação, através do método `ready()` do `CoreConfig` em `apps.py`:

```python
# core/apps.py
class CoreConfig(AppConfig):
    name = 'core'
    def ready(self):
        import core.signals  # registra os signals ao iniciar o servidor
```

### Fluxo de sincronização passo a passo

```
1. Usuário abre chamado no frontend
          ↓
2. React envia POST /api/chamados/ com token Firebase
          ↓
3. Django valida o token (FirebaseMiddleware)
          ↓
4. View cria o Chamado no SQL Server (Banco 2)
   → Chamado.objects.create(...)
          ↓
5. Django dispara automaticamente: post_save → atualizar_leitura()
          ↓
6. Signal cria o registro espelhado no SQLite (Banco 3)
   → DashboardChamados.objects.using('leitura').create(...)
          ↓
7. Dashboard já pode ler os novos dados do SQLite
```

O mesmo fluxo ocorre ao **atualizar o status** de um chamado: o `Chamado.save()` no SQL Server dispara o signal, que atualiza o `status_atual` no SQLite.

---

## ⏱️ Latência e Consistência Eventual

### Latência medida

| Operação | Banco escrito | Sincronização para SQLite | Latência total |
|----------|---------------|--------------------------|----------------|
| Criar chamado | SQL Server | Imediata (mesma thread) | < 50ms |
| Atualizar status | SQL Server | Imediata (mesma thread) | < 50ms |
| Excluir chamado | SQL Server | Imediata (mesma chamada de view) | < 50ms |

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

A aplicação implementa degradação graciosa em caso de falha de um dos bancos:

### Cenário A — SQLite (Banco 3) cai

As views de leitura (`GET /api/chamados/` e `GET /api/dashboard/stats/`) capturam a exceção e redirecionam automaticamente para o SQL Server:

```python
# views.py — chamados()
try:
    registros = DashboardChamados.objects.using('leitura')...  # SQLite
except Exception:
    registros = Chamado.objects.order_by(...)...               # fallback: SQL Server
    return JsonResponse({..., 'aviso': 'Banco de leitura indisponível.'})
```

O frontend exibe um banner de aviso `⚠ modo fallback ativo` sem interromper o funcionamento.

### Cenário B — SQL Server (Banco 2) cai

- Login via Firebase: **continua funcionando** (banco independente)
- Leitura do dashboard: **continua funcionando** (dados do SQLite)
- Criação/atualização de chamados: **desabilitada** com mensagem clara

---

## 📁 Estrutura do Projeto

```
setup_helpdesk/
├── core/
│   ├── models.py          # Modelos: Usuario, Chamado (SQL Server) e DashboardChamados (SQLite)
│   ├── views.py           # Endpoints da API REST
│   ├── signals.py         # ⭐ Sincronização SQL Server → SQLite (post_save)
│   ├── routers.py         # CQRS Router — roteamento automático de queries
│   ├── middleware.py      # Validação do token Firebase em todas as escritas
│   ├── firebase_config.py # Inicialização do Firebase Admin SDK
│   └── apps.py            # Registro dos signals no startup do Django
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
| `GET` | `/api/dashboard/stats/` | ❌ | SQLite → fallback SQL Server | Métricas analíticas |

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

python manage.py migrate --database=default   # cria tabelas no SQL Server
python manage.py migrate --database=leitura   # cria tabelas no SQLite

python manage.py runserver 8000
```

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

O mecanismo de signal é ativado automaticamente no startup via `apps.py` e não requer nenhuma configuração externa, tornando o projeto completamente autocontido e fácil de executar em qualquer ambiente de desenvolvimento.
