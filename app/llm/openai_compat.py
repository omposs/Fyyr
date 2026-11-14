"""Provider for any OpenAI-compatible chat endpoint. Ollama exposes one at http://localhost:11434/v1,
so this gives you real model extraction on your own machine with no paid key.

Small local models follow the "reply with JSON only" instruction less reliably than Claude, so
`structured` is strict about parsing and raises ValueError on anything that is not a JSON object;
the profiling agent retries and then reports the source as failed rather than trusting garbage.
"""
from __future__ import annotations

import json
import re
from typing import Any

import httpx

from app.llm.base import ProviderError

_FENCE = re.compile(r"^```(?:json)?\s*(.*?)\s*```$", re.DOTALL | re.IGNORECASE)


def parse_json_object(text: str) -> dict[str, Any]:
    text = text.strip()
    m = _FENCE.match(text)
    if m:
        text = m.group(1)
    if not text.startswith("{"):  # models often add a sentence before the JSON
        start, end = text.find("{"), text.rfind("}")
        if start == -1 or end <= start:
            raise ValueError("no JSON object in model output")
        text = text[start : end + 1]
    obj = json.loads(text)  # JSONDecodeError is a ValueError
    if not isinstance(obj, dict):
        raise ValueError("model output is not a JSON object")
    return obj


class OpenAICompatProvider:
    name = "openai_compat"

    def __init__(self, base_url: str, model: str, api_key: str | None = None, timeout: float = 180.0,
                 max_tokens: int = 1500, client: httpx.Client | None = None):
        self.base_url = base_url.rstrip("/")
        self.model, self.max_tokens = model, max_tokens
        headers = {"Authorization": f"Bearer {api_key}"} if api_key else {}
        self.client = client or httpx.Client(timeout=timeout, headers=headers)

    def _complete(self, messages: list[dict[str, str]], json_mode: bool) -> str:
        body: dict[str, Any] = {"model": self.model, "messages": messages, "max_tokens": self.max_tokens,
                                "temperature": 0}
        if json_mode:
            body["response_format"] = {"type": "json_object"}
        try:
            r = self.client.post(f"{self.base_url}/chat/completions", json=body)
            r.raise_for_status()
            return r.json()["choices"][0]["message"]["content"] or ""
        except httpx.HTTPError as e:
            raise ProviderError(f"{type(e).__name__}: {e}") from e
        except (KeyError, IndexError, ValueError) as e:  # unexpected response shape from the server
            raise ProviderError(f"unexpected response from model server: {e!r}") from e

    def structured(self, *, task: str, system: str, user: str, schema: dict[str, Any]) -> dict[str, Any]:
        instruction = (f"{system}\n\nRespond with ONLY a JSON object that matches this JSON schema. "
                       f"No prose, no code fences.\n{json.dumps(schema)}")
        text = self._complete([{"role": "system", "content": instruction}, {"role": "user", "content": user}],
                              json_mode=True)
        return parse_json_object(text)

    def chat(self, *, task: str, system: str, messages: list[dict[str, str]]) -> str:
        return self._complete([{"role": "system", "content": system}, *messages], json_mode=False)
