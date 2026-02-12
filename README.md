# Ancre

> SaaS de RAG (Retrieval-Augmented Generation) multi-tenant avec assistants personnalisables.

## Fonctionnalités

- **Multi-tenant** — Isolation complète par tenant avec quotas et abonnements
- **Multi-assistants** — Créez plusieurs assistants avec leurs propres collections de documents
- **RAG Pipeline** — Upload → Parse → Chunk → Embed → Index → Query
- **Streaming** — Réponses en temps réel via SSE
- **Citations** — Sources citées avec numéro de page et extrait
- **Authentification** — Clerk pour l'auth utilisateur
- **Billing** — Stripe pour les abonnements (Free / Pro)

## Stack

| Composant | Technologie |
|-----------|-------------|
| **Backend** | FastAPI, Pydantic v2, SQLAlchemy 2.0 (async), Uvicorn |
| **Frontend** | React 18, Vite 6, TypeScript |
| **UI** | TailwindCSS, shadcn/ui (Radix UI), Lucide icons |
| **State / Data** | TanStack Query (React Query), Zustand |
| **Base de données** | PostgreSQL 16 |
| **Vector Store** | Qdrant |
| **Stockage fichiers** | MinIO (dev) / S3 (prod) |
| **File d’attente** | Arq + Redis 7 |
| **Auth** | Clerk (JWT + JWKS) |
| **Billing** | Stripe |
| **LLM / Embeddings** | OpenAI (GPT-4o-mini, text-embedding-3-small) |
| **Chat / RAG** | SSE streaming, Assistant UI (composer, dictée) |
| **Generative UI** | CopilotKit (runtime Node.js + React) |
| **OAuth / Connecteurs** | Nango (self-hosted) |

## Outils de développement

- **Python** : uv ou pip, venv, Ruff (lint/format), Pytest
- **Node** : npm, Vite (dev server + build)
- **DB** : Alembic (migrations)
- **Conteneurs** : Docker & Docker Compose (PostgreSQL, Redis, Qdrant, MinIO, Nango, CopilotKit runtime)

## Structure du projet

```
├── app/                    # Backend FastAPI
│   ├── api/v1/            # Routes API
│   ├── core/              # Auth, chunking, parsing, vector store
│   ├── models/            # Modèles SQLAlchemy
│   ├── schemas/           # Schémas Pydantic
│   ├── services/          # Logique métier
│   └── workers/           # Workers Arq (ingestion async)
├── frontend/              # Frontend React + Vite
│   └── src/
│       ├── api/           # Clients API
│       ├── components/    # Composants UI
│       └── pages/         # Pages de l'application
├── copilot-runtime/       # CopilotKit Node.js runtime
├── alembic/               # Migrations database
├── tests/                 # Tests
└── docs/                  # Documentation
    └── integrations/      # CopilotKit & Nango docs
```

## Prérequis

- **Python 3.11+**
- **Node.js 18+** (LTS recommandé)
- **Docker & Docker Compose** (pour PostgreSQL, Redis, Qdrant, MinIO, Nango)
- Comptes / clés : [OpenAI](https://platform.openai.com/api-keys), [Clerk](https://dashboard.clerk.com) (optionnel en dev avec `DEV_AUTH_BYPASS=true`), [Stripe](https://dashboard.stripe.com) (optionnel pour le billing)

## Installation en local

### 1. Cloner le dépôt

```bash
git clone https://github.com/<org>/ancre-ai.git
cd ancre-ai
```

### 2. Environnement Python

```bash
# Créer et activer un venv (recommandé)
python3.11 -m venv .venv
source .venv/bin/activate   # Linux / macOS
# .venv\Scripts\activate    # Windows

# Installer les dépendances (backend)
make dev
# ou : pip install -e ".[dev]"
```

### 3. Variables d’environnement backend

À la **racine** du projet :

```bash
cp .env.example .env
```

Éditer `.env` et renseigner au minimum :

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Déjà prêt si vous gardez `postgresql+asyncpg://mecano:mecano@localhost:5432/mecano` après `make up` |
| `OPENAI_API_KEY` | Clé API OpenAI (obligatoire pour RAG et CopilotKit) |
| `CLERK_SECRET_KEY` | Clé secrète Clerk ([dashboard](https://dashboard.clerk.com)) |
| `CLERK_PUBLISHABLE_KEY` | Clé publique Clerk (même dashboard) |
| `CLERK_JWKS_URL` | `https://<votre-instance>.clerk.accounts.dev/.well-known/jwks.json` |

En dev, `DEV_AUTH_BYPASS=true` permet de tester sans Clerk. Stripe, Nango et CopilotKit ont des valeurs par défaut ou optionnelles (voir `.env.example`).

### 4. Variables d’environnement frontend

Dans le dossier **frontend** :

```bash
cp frontend/.env.example frontend/.env
```

À configurer :

| Variable | Description |
|----------|-------------|
| `VITE_CLERK_PUBLISHABLE_KEY` | Même clé publique Clerk que le backend (préfixe **VITE_** obligatoire pour Vite) |

Sans clé Clerk valide, l’app tourne en mode « sans auth » (message en console). Les autres variables (`VITE_STRIPE_PUBLISHABLE_KEY`, `VITE_COPILOTKIT_RUNTIME_URL`, etc.) sont optionnelles pour un premier run.

### 5. Dépendances frontend

```bash
cd frontend
npm install
cd ..
```

### 6. Lancer les services Docker

À la racine :

```bash
make up
```

Démarre PostgreSQL, Redis, Qdrant, MinIO, Nango et (optionnel) le runtime CopilotKit. Attendre quelques secondes que les healthchecks passent.

### 7. Migrations base de données

```bash
make migrate
# ou : alembic upgrade head
```

### 8. Démarrer l’application

Ouvrir **4 terminaux** à la racine du projet :

| Terminal | Commande | Rôle |
|----------|----------|------|
| 1 | `make api` | API FastAPI (port 8000) |
| 2 | `make worker` | Worker Arq (ingestion documents) |
| 3 | `cd frontend && npm run dev` | Frontend Vite (port 3000) |
| 4 | `cd copilot-runtime && npm run dev` | CopilotKit runtime (port 4000, optionnel) |

Ou utiliser le script fourni (si présent) : `make start` / `./start-dev.sh`.

### URLs locales

| Service | URL |
|---------|-----|
| **Frontend** | http://localhost:3000 |
| **API** | http://localhost:8000 |
| **Swagger** | http://localhost:8000/docs |
| **ReDoc** | http://localhost:8000/redoc |
| **MinIO Console** | http://localhost:9001 |
| **Qdrant Dashboard** | http://localhost:6333/dashboard |
| **CopilotKit Runtime** | http://localhost:4000 |
| **Nango** | http://localhost:3003 |

## API Endpoints

### Tenants
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `POST` | `/api/v1/tenants` | Créer un tenant |
| `GET` | `/api/v1/tenants` | Lister les tenants |
| `GET` | `/api/v1/tenants/{id}` | Détails d'un tenant |

### Collections
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `POST` | `/api/v1/collections` | Créer une collection |
| `GET` | `/api/v1/collections` | Lister les collections |
| `DELETE` | `/api/v1/collections/{id}` | Supprimer une collection |

### Documents
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `POST` | `/api/v1/documents/upload/{collection_id}` | Uploader un fichier |
| `GET` | `/api/v1/documents` | Lister les documents |
| `DELETE` | `/api/v1/documents/{id}` | Supprimer un document |

### Assistants
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `POST` | `/api/v1/assistants` | Créer un assistant |
| `GET` | `/api/v1/assistants` | Lister les assistants |
| `PATCH` | `/api/v1/assistants/{id}` | Modifier un assistant |
| `DELETE` | `/api/v1/assistants/{id}` | Supprimer un assistant |

### Chat
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `POST` | `/api/v1/chat/{assistant_id}` | Chat (réponse complète) |
| `POST` | `/api/v1/chat/{assistant_id}/stream` | Chat (SSE streaming) |
| `GET` | `/api/v1/chat/{assistant_id}/conversations/{id}` | Historique conversation |

### Usage & Billing
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `GET` | `/api/v1/usage` | Usage courant avec quotas |
| `GET` | `/api/v1/usage/history` | Historique d'usage |
| `POST` | `/api/v1/billing/checkout` | Créer une session Stripe |
| `POST` | `/api/v1/billing/portal` | Portail client Stripe |

### Intégrations (Nango)
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `POST` | `/api/v1/integrations/nango/connect/{provider}` | Initier une connexion OAuth |
| `GET` | `/api/v1/integrations/nango/callback` | Callback OAuth |
| `GET` | `/api/v1/integrations/nango/connections` | Lister les connexions du tenant |
| `DELETE` | `/api/v1/integrations/nango/connections/{provider}` | Supprimer une connexion |

### CopilotKit
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `POST` | `/api/v1/copilotkit/actions/kpi` | Action KPI (données structurées) |

## Formats de documents supportés

| Format | Extensions |
|--------|------------|
| PDF | `.pdf` |
| Word | `.docx` |
| PowerPoint | `.pptx` |
| HTML | `.html`, `.htm` |
| Markdown | `.md` |
| Texte | `.txt` |

## Configuration

**Backend** (racine, fichier `.env`) — variables principales :

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | URL PostgreSQL (async) |
| `REDIS_URL` | URL Redis |
| `QDRANT_URL` | URL Qdrant |
| `OPENAI_API_KEY` | Clé API OpenAI |
| `EMBEDDING_MODEL` | Modèle embeddings (défaut: `text-embedding-3-small`) |
| `LLM_MODEL` | Modèle LLM (défaut: `gpt-4o-mini`) |
| `CLERK_SECRET_KEY` | Clé secrète Clerk |
| `CLERK_PUBLISHABLE_KEY` | Clé publique Clerk |
| `CLERK_JWKS_URL` | URL JWKS Clerk (validation JWT) |
| `STRIPE_SECRET_KEY` | Clé secrète Stripe |
| `DEV_AUTH_BYPASS` | Bypass auth en dev (défaut: `true`) |
| `NANGO_URL` | URL du serveur Nango (défaut: `http://localhost:3003`) |
| `NANGO_SECRET_KEY` | Clé secrète Nango |
| `COPILOTKIT_RUNTIME_URL` | URL du runtime CopilotKit (défaut: `http://localhost:4000`) |

**Frontend** (`frontend/.env`) — préfixe **`VITE_`** obligatoire pour exposition au navigateur :

| Variable | Description |
|----------|-------------|
| `VITE_CLERK_PUBLISHABLE_KEY` | Clé publique Clerk (même que backend) |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Clé publique Stripe (optionnel) |
| `VITE_COPILOTKIT_RUNTIME_URL` | URL du runtime CopilotKit (défaut: `/copilotkit` en dev) |

Voir `.env.example` et `frontend/.env.example` pour la liste complète.

## Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Frontend   │────▶│   FastAPI    │────▶│  PostgreSQL  │
│  React/Vite  │     │    + Arq     │     │              │
│  + CopilotKit│     └──────┬───────┘     └──────────────┘
└──────┬───────┘            │
       │        ┌───────────┼────────────────┐
       │        ▼           ▼                ▼
       │  ┌──────────┐┌──────────┐     ┌──────────┐
       │  │  Redis   ││  Qdrant  │     │  MinIO   │
       │  │  (queue) ││ (vectors)│     │   (S3)   │
       │  └────┬─────┘└──────────┘     └──────────┘
       │       │
       │       ▼
       │  ┌──────────┐
       │  │  Worker  │──▶ Parse → Chunk → Embed → Index
       │  └──────────┘
       │
       │  ┌──────────────┐     ┌──────────────┐
       └─▶│  CopilotKit  │     │    Nango     │
          │  Runtime     │     │  (OAuth)     │
          │  (Node :4000)│     │  (:3003)     │
          └──────────────┘     └──────────────┘
```

## Commandes Make

```bash
make install   # Installer les dépendances Python (prod)
make dev      # Installer les dépendances Python (avec dev)
make up       # Démarrer tous les services Docker
make down     # Arrêter les services Docker
make setup    # install + up + migrate (bootstrap rapide)
make api      # Lancer l’API FastAPI (port 8000)
make worker   # Lancer le worker Arq
make migrate  # Appliquer les migrations Alembic
make start    # Démarrer API + frontend (script start-dev.sh)
make test     # Lancer les tests (pytest)
make lint     # Linter (ruff)
make format   # Formater le code (ruff)
make clean    # Nettoyer caches Python
```

## License

MIT
