# Ancre - Multi-tenant RAG SaaS Backend

Backend API pour un SaaS de RAG (Retrieval-Augmented Generation) multi-assistants.

## Features

- **Multi-tenant**: Isolation par tenant avec quotas
- **Multi-assistants**: Jusqu'à 3 assistants par tenant (configurable)
- **RAG Pipeline**: Upload → Parse → Chunk → Embed → Index → Query
- **Streaming**: Réponses en temps réel via SSE
- **Citations**: Sources citées avec page et extrait
- **Quotas**: Limites sur ingestion, chat et stockage

## Stack technique

- **API**: FastAPI + Pydantic v2
- **Database**: PostgreSQL + SQLAlchemy 2.0
- **Vector Store**: Qdrant
- **Object Storage**: MinIO (dev) / S3 (prod)
- **Task Queue**: Arq (Redis)
- **LLM/Embeddings**: OpenAI

## Quick Start

### 1. Prérequis

- Python 3.11+
- Docker & Docker Compose

### 2. Installation

```bash
# Clone et setup
git clone <repo>
cd mecano-man

# Copier la config
cp .env.example .env
# Éditer .env avec votre clé OpenAI

# Installer les dépendances
make dev

# Démarrer les services
make up

# Appliquer les migrations
make migrate
```

### 3. Démarrer

```bash
# Terminal 1: API
make api

# Terminal 2: Worker (pour l'ingestion)
make worker
```

L'API est disponible sur http://localhost:8000

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## API Endpoints

### Tenants
- `POST /api/v1/tenants` - Créer un tenant
- `GET /api/v1/tenants` - Lister les tenants
- `GET /api/v1/tenants/{id}` - Détails d'un tenant

### Collections
- `POST /api/v1/collections` - Créer une collection
- `GET /api/v1/collections` - Lister les collections
- `DELETE /api/v1/collections/{id}` - Supprimer une collection

### Documents
- `POST /api/v1/documents/upload/{collection_id}` - Upload un fichier
- `GET /api/v1/documents` - Lister les documents
- `DELETE /api/v1/documents/{id}` - Supprimer un document

### Assistants
- `POST /api/v1/assistants` - Créer un assistant
- `GET /api/v1/assistants` - Lister les assistants
- `PATCH /api/v1/assistants/{id}` - Modifier un assistant

### Chat
- `POST /api/v1/chat/{assistant_id}` - Chat (non-streaming)
- `POST /api/v1/chat/{assistant_id}/stream` - Chat (SSE streaming)
- `GET /api/v1/chat/{assistant_id}/conversations/{conversation_id}` - Historique

### Usage
- `GET /api/v1/usage` - Usage courant avec quotas
- `GET /api/v1/usage/history` - Historique d'usage

## Exemple d'utilisation

```bash
# Header requis pour tous les appels
TENANT_HEADER="X-Tenant-ID: <tenant-uuid>"

# 1. Créer un tenant
curl -X POST http://localhost:8000/api/v1/tenants \
  -H "Content-Type: application/json" \
  -d '{"name": "Mon Workspace"}'

# 2. Créer une collection
curl -X POST http://localhost:8000/api/v1/collections \
  -H "$TENANT_HEADER" \
  -H "Content-Type: application/json" \
  -d '{"name": "Documentation"}'

# 3. Uploader un document
curl -X POST http://localhost:8000/api/v1/documents/upload/<collection-id> \
  -H "$TENANT_HEADER" \
  -F "file=@document.pdf"

# 4. Créer un assistant
curl -X POST http://localhost:8000/api/v1/assistants \
  -H "$TENANT_HEADER" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Mon Assistant",
    "system_prompt": "Tu es un assistant qui répond en français.",
    "collection_ids": ["<collection-id>"]
  }'

# 5. Chatter
curl -X POST http://localhost:8000/api/v1/chat/<assistant-id> \
  -H "$TENANT_HEADER" \
  -H "Content-Type: application/json" \
  -d '{"message": "Résume ce document"}'
```

## Formats supportés

- PDF (`.pdf`)
- Word (`.docx`)
- PowerPoint (`.pptx`)
- HTML (`.html`, `.htm`)
- Markdown (`.md`)
- Text (`.txt`)

## Configuration

Voir `.env.example` pour toutes les options:

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection | `postgresql+asyncpg://...` |
| `REDIS_URL` | Redis connection | `redis://localhost:6379` |
| `QDRANT_URL` | Qdrant server | `http://localhost:6333` |
| `OPENAI_API_KEY` | Clé API OpenAI | - |
| `EMBEDDING_MODEL` | Modèle embeddings | `text-embedding-3-small` |
| `LLM_MODEL` | Modèle chat | `gpt-4o-mini` |
| `CHUNK_SIZE` | Taille chunks (tokens) | `800` |
| `CHUNK_OVERLAP` | Overlap (tokens) | `100` |

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │────▶│   FastAPI   │────▶│  PostgreSQL │
└─────────────┘     └──────┬──────┘     └─────────────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        ┌─────────┐  ┌─────────┐  ┌─────────┐
        │  Redis  │  │ Qdrant  │  │  MinIO  │
        │  (Arq)  │  │(vectors)│  │  (S3)   │
        └────┬────┘  └─────────┘  └─────────┘
             │
             ▼
        ┌─────────┐
        │ Worker  │──▶ Parse → Chunk → Embed → Index
        └─────────┘
```

## License

MIT
