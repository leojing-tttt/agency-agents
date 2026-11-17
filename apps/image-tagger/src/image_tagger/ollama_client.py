from __future__ import annotations

import base64
import json
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any


class OllamaError(RuntimeError):
    pass


def encode_image(path: Path) -> str:
    return base64.b64encode(path.read_bytes()).decode("ascii")


def generate_vision_json(
    *,
    host: str,
    model: str,
    prompt: str,
    system: str,
    image_path: Path,
    timeout_s: float = 600.0,
) -> dict[str, Any]:
    """Call Ollama /api/generate with one image; parse JSON object from response."""
    payload = {
        "model": model,
        "system": system,
        "prompt": prompt,
        "images": [encode_image(image_path)],
        "stream": False,
        "format": "json",
        "options": {"temperature": 0.2},
    }
    url = host.rstrip("/") + "/api/generate"
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout_s) as resp:
            body = json.load(resp)
    except urllib.error.URLError as e:
        raise OllamaError(f"ollama unreachable at {url}: {e}") from e

    text = body.get("response", "")
    if isinstance(text, dict):
        return text
    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        raise OllamaError(f"model did not return JSON: {text[:500]!r}") from e
