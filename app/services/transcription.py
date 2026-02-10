"""Transcription service using OpenAI Whisper API."""

import io
import logging

from openai import AsyncOpenAI

from app.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)


class TranscriptionService:
    """Audio-to-text transcription via OpenAI Whisper."""

    def __init__(self) -> None:
        self.client = AsyncOpenAI(api_key=settings.openai_api_key)

    async def transcribe(
        self,
        audio_data: bytes,
        filename: str = "audio.webm",
        language: str = "fr",
    ) -> tuple[str, float]:
        """Transcribe audio data.

        Returns:
            Tuple of (transcribed_text, duration_seconds).
        """
        audio_file = io.BytesIO(audio_data)
        audio_file.name = filename

        response = await self.client.audio.transcriptions.create(
            model="whisper-1",
            file=audio_file,
            language=language,
            response_format="verbose_json",
        )

        text: str = response.text
        duration: float = response.duration or 0.0

        logger.info(
            "Transcribed %.1fs of audio (%d bytes) → %d chars",
            duration,
            len(audio_data),
            len(text),
        )

        return text, duration


transcription_service = TranscriptionService()
