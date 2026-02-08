"""Application configuration using pydantic-settings."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Database
    database_url: str = "postgresql+asyncpg://mecano:mecano@localhost:5432/mecano"

    # Redis
    redis_url: str = "redis://localhost:6379"

    # Qdrant
    qdrant_url: str = "http://localhost:6333"
    qdrant_collection: str = "mecano_chunks"

    # S3 / MinIO
    s3_endpoint_url: str | None = "http://localhost:9000"
    s3_access_key: str = "minioadmin"
    s3_secret_key: str = "minioadmin"
    s3_bucket: str = "mecano-documents"
    s3_region: str = "us-east-1"

    # OpenAI
    openai_api_key: str = ""

    # Embeddings
    embedding_model: str = "text-embedding-3-small"
    embedding_dimensions: int = 1536

    # LLM
    llm_model: str = "gpt-4o-mini"
    llm_max_tokens: int = 4096

    # Chunking
    chunk_size: int = 800  # tokens
    chunk_overlap: int = 100  # tokens

    # App
    debug: bool = False
    log_level: str = "INFO"

    # Clerk Authentication
    clerk_secret_key: str = ""
    clerk_publishable_key: str = ""
    clerk_jwks_url: str = ""  # https://<clerk-domain>/.well-known/jwks.json

    # Stripe Billing
    stripe_secret_key: str = ""
    stripe_publishable_key: str = ""
    stripe_webhook_secret: str = ""
    stripe_pro_price_id: str = ""  # price_xxx for 15€/month

    # Free tier quotas
    free_daily_chat_limit: int = 100
    free_max_files: int = 5

    # Dev mode: bypass Clerk auth
    dev_auth_bypass: bool = False

    # Nango (OAuth connector management)
    nango_url: str = "http://localhost:3003"
    nango_secret_key: str = ""
    nango_public_key: str = ""

    # CopilotKit
    copilotkit_runtime_url: str = "http://localhost:4000"


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
