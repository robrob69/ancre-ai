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
| **Backend** | FastAPI, Pydantic v2, SQLAlchemy 2.0 |
| **Frontend** | React, Vite, TailwindCSS, shadcn/ui |
| **Database** | PostgreSQL |
| **Vector Store** | Qdrant |
| **Object Storage** | MinIO (dev) / S3 (prod) |
| **Task Queue** | Arq + Redis |
| **Auth** | Clerk |
| **Billing** | Stripe |
| **LLM/Embeddings** | OpenAI |

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
├── alembic/               # Migrations database
├── tests/                 # Tests
└── docs/                  # Documentation API
```

## Prérequis

- Python 3.11+
- Node.js 18+
- Docker & Docker Compose

## Installation

```bash
# Cloner le repo
git clone <repo>
cd mecano-man

# Configurer l'environnement
cp .env.example .env
cp frontend/.env.example frontend/.env
# Éditer les fichiers .env avec vos clés (OpenAI, Clerk, Stripe)

# Installer les dépendances Python
make dev

# Installer les dépendances frontend
cd frontend && npm install && cd ..

# Démarrer les services Docker (PostgreSQL, Redis, Qdrant, MinIO)
make up

# Appliquer les migrations
make migrate
```

## Démarrage

```bash
# Terminal 1 — Backend API
make api

# Terminal 2 — Worker (ingestion documents)
make worker

# Terminal 3 — Frontend
cd frontend && npm run dev
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| API | http://localhost:8000 |
| Swagger | http://localhost:8000/docs |
| ReDoc | http://localhost:8000/redoc |
| MinIO Console | http://localhost:9001 |
| Qdrant Dashboard | http://localhost:6333/dashboard |

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

Les variables d'environnement principales :

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | URL PostgreSQL |
| `REDIS_URL` | URL Redis |
| `QDRANT_URL` | URL Qdrant |
| `OPENAI_API_KEY` | Clé API OpenAI |
| `EMBEDDING_MODEL` | Modèle embeddings (défaut: `text-embedding-3-small`) |
| `LLM_MODEL` | Modèle LLM (défaut: `gpt-4o-mini`) |
| `CLERK_SECRET_KEY` | Clé secrète Clerk |
| `STRIPE_SECRET_KEY` | Clé secrète Stripe |
| `DEV_AUTH_BYPASS` | Bypass auth en dev (défaut: `true`) |

Voir `.env.example` pour la liste complète.

## Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Frontend   │────▶│   FastAPI    │────▶│  PostgreSQL  │
│  React/Vite  │     │    + Arq     │     │              │
└──────────────┘     └──────┬───────┘     └──────────────┘
                            │
           ┌────────────────┼────────────────┐
           ▼                ▼                ▼
     ┌──────────┐     ┌──────────┐     ┌──────────┐
     │  Redis   │     │  Qdrant  │     │  MinIO   │
     │  (queue) │     │ (vectors)│     │   (S3)   │
     └────┬─────┘     └──────────┘     └──────────┘
          │
          ▼
     ┌──────────┐
     │  Worker  │──▶ Parse → Chunk → Embed → Index
     └──────────┘
```

## Commandes Make

```bash
make dev       # Installer les dépendances Python
make up        # Démarrer les services Docker
make down      # Arrêter les services Docker
make api       # Lancer l'API FastAPI
make worker    # Lancer le worker Arq
make migrate   # Appliquer les migrations Alembic
make test      # Lancer les tests
make lint      # Lancer le linter (ruff)
```

## License

MIT
