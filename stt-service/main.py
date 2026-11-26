"""
Self-deployed open-source Faster-Whisper WebSocket Speech-to-Text service.
Supports real-time multilingual transcription (Hindi + English code-switching, etc.).
"""

import asyncio
import json
import os
from typing import Optional

import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from faster_whisper import WhisperModel

MODEL_SIZE = os.getenv("WHISPER_MODEL", "small")
DEVICE = os.getenv("WHISPER_DEVICE", "cpu")
COMPUTE_TYPE = os.getenv("WHISPER_COMPUTE_TYPE", "int8")
SAMPLE_RATE = 16000
CHUNK_SECONDS = 2.0
BYTES_PER_SECOND = SAMPLE_RATE * 2  # 16-bit PCM mono

app = FastAPI(title="VoxScribe Open-Source Faster-Whisper STT", version="1.0.0")
_model: Optional[WhisperModel] = None


def get_model() -> WhisperModel:
    global _model
    if _model is None:
        _model = WhisperModel(MODEL_SIZE, device=DEVICE, compute_type=COMPUTE_TYPE)
    return _model


@app.on_event("startup")
async def warmup() -> None:
    # Preload the model in a background thread on container startup
    loop = asyncio.get_running_loop()
    await loop.run_in_executor(None, get_model)


@app.get("/health")
async def health() -> dict:
    return {
        "status": "ok",
        "engine": "faster-whisper",
        "model": MODEL_SIZE,
        "device": DEVICE,
    }


def transcribe_pcm(pcm_bytes: bytes, language: Optional[str]) -> tuple[str, str]:
    audio = np.frombuffer(pcm_bytes, dtype=np.int16).astype(np.float32) / 32768.0
    if len(audio) < SAMPLE_RATE * 0.35:
        return "", language or "auto"

    # Skip near-silent chunks to save CPU
    rms = float(np.sqrt(np.mean(np.square(audio))))
    if rms < 0.008:
        return "", language or "auto"

    model = get_model()
    lang_arg = None if not language or language in ("auto", "hi-en", "multilingual") else language.split("-")[0]
    initial_prompt = (
        "Transcribed speech may mix Hindi and English (Hinglish) naturally."
        if language in ("hi-en", "multilingual", "auto", None)
        else None
    )

    segments, info = model.transcribe(
        audio,
        language=lang_arg,
        beam_size=1,
        vad_filter=True,
        initial_prompt=initial_prompt,
    )
    text = " ".join(seg.text.strip() for seg in segments if seg.text.strip()).strip()
    detected = getattr(info, "language", None) or (lang_arg or "auto")
    return text, detected


@app.websocket("/ws/transcribe")
async def ws_transcribe(websocket: WebSocket) -> None:
    await websocket.accept()
    language = websocket.query_params.get("language", "hi-en")
    buffer = bytearray()
    chunk_threshold = int(BYTES_PER_SECOND * CHUNK_SECONDS)
    loop = asyncio.get_running_loop()

    await websocket.send_text(
        json.dumps({"type": "ready", "engine": "faster-whisper", "model": MODEL_SIZE})
    )

    try:
        while True:
            message = await websocket.receive()
            if "bytes" in message and message["bytes"]:
                buffer.extend(message["bytes"])
                if len(buffer) >= chunk_threshold:
                    pcm_snapshot = bytes(buffer)
                    buffer.clear()
                    text, detected = await loop.run_in_executor(
                        None, transcribe_pcm, pcm_snapshot, language
                    )
                    if text:
                        await websocket.send_text(
                            json.dumps(
                                {
                                    "type": "transcript",
                                    "text": text,
                                    "isFinal": True,
                                    "language": detected,
                                }
                            )
                        )
            elif "text" in message and message["text"]:
                payload = json.loads(message["text"])
                if payload.get("type") == "config" and payload.get("language"):
                    language = payload["language"]
                elif payload.get("type") == "stop":
                    if len(buffer) > 0:
                        pcm_snapshot = bytes(buffer)
                        buffer.clear()
                        text, detected = await loop.run_in_executor(
                            None, transcribe_pcm, pcm_snapshot, language
                        )
                        if text:
                            await websocket.send_text(
                                json.dumps(
                                    {
                                        "type": "transcript",
                                        "text": text,
                                        "isFinal": True,
                                        "language": detected,
                                    }
                                )
                            )
                    await websocket.send_text(json.dumps({"type": "done"}))
                    break
    except WebSocketDisconnect:
        pass
    except Exception as exc:
        try:
            await websocket.send_text(
                json.dumps({"type": "error", "message": str(exc)})
            )
        except Exception:
            pass

