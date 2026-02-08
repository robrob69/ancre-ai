"""HTTP client for Nango API.

Nango manages OAuth tokens and provides a REST API to:
- Create connections (initiate OAuth flows)
- List connections
- Retrieve access tokens (for calling CRM/ERP APIs)

We never store OAuth tokens ourselves. Nango handles token refresh
and storage. We only store a reference (connection_id + provider)
in our DB linked to the tenant.
"""

import httpx

from app.config import get_settings


class NangoClient:
    """Async HTTP client for the Nango REST API."""

    def __init__(self) -> None:
        settings = get_settings()
        self.base_url = settings.nango_url.rstrip("/")
        self.secret_key = settings.nango_secret_key

    @property
    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.secret_key}",
            "Content-Type": "application/json",
        }

    async def create_connection_session(
        self,
        provider_config_key: str,
        connection_id: str,
    ) -> dict:
        """Create a session token for the Nango Connect frontend widget.

        This returns a token that the frontend can use to open the
        OAuth popup via @nangohq/frontend or a direct redirect URL.

        Args:
            provider_config_key: The integration key in Nango (e.g. "hubspot", "salesforce")
            connection_id: Unique ID we assign (tenant_id + provider)

        Returns:
            Dict with connect_session_token and possibly a redirect URL
        """
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/connect/sessions",
                headers=self._headers,
                json={
                    "end_user": {
                        "id": connection_id,
                        "display_name": connection_id,
                    },
                    "allowed_integrations": [provider_config_key],
                },
            )
            response.raise_for_status()
            return response.json()

    async def list_connections(self, connection_id: str | None = None) -> list[dict]:
        """List connections, optionally filtered by connection_id.

        Args:
            connection_id: Optional filter for a specific connection

        Returns:
            List of connection dicts from Nango API
        """
        params: dict[str, str] = {}
        if connection_id:
            params["connectionId"] = connection_id

        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/connections",
                headers=self._headers,
                params=params,
            )
            response.raise_for_status()
            data = response.json()
            return data.get("connections", [])

    async def get_connection(
        self,
        provider_config_key: str,
        connection_id: str,
    ) -> dict:
        """Get details of a specific connection.

        Args:
            provider_config_key: Integration key
            connection_id: Connection ID

        Returns:
            Connection details dict
        """
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/connections/{connection_id}",
                headers=self._headers,
                params={"provider_config_key": provider_config_key},
            )
            response.raise_for_status()
            return response.json()

    async def delete_connection(
        self,
        provider_config_key: str,
        connection_id: str,
    ) -> None:
        """Delete a connection.

        Args:
            provider_config_key: Integration key
            connection_id: Connection ID
        """
        async with httpx.AsyncClient() as client:
            response = await client.delete(
                f"{self.base_url}/connections/{connection_id}",
                headers=self._headers,
                params={"provider_config_key": provider_config_key},
            )
            response.raise_for_status()

    async def get_token(
        self,
        provider_config_key: str,
        connection_id: str,
    ) -> dict:
        """Get the current access token for a connection.

        Nango handles token refresh automatically. This returns
        the current valid token we can use to call the provider API.

        Args:
            provider_config_key: Integration key
            connection_id: Connection ID

        Returns:
            Dict with access_token and metadata
        """
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/connections/{connection_id}",
                headers=self._headers,
                params={
                    "provider_config_key": provider_config_key,
                    "force_refresh": "false",
                },
            )
            response.raise_for_status()
            return response.json()


# Global instance
nango_client = NangoClient()
