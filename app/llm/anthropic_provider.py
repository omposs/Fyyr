from __future__ import annotations

from typing import Any

import anthropic

from app.llm.base import ProviderError


class AnthropicProvider:
    name = "anthropic"

    def __init__(self, api_key: str, model: str, max_tokens: int = 1500):
        self.client = anthropic.Anthropic(api_key=api_key)
        self.model = model
        self.max_tokens = max_tokens

    def structured(self, *, task: str, system: str, user: str, schema: dict[str, Any]) -> dict[str, Any]:
        # Forcing a tool call is the most reliable way to get schema-shaped JSON back.
        tool = {"name": "emit", "description": f"Return the result of task '{task}'.", "input_schema": schema}
        try:
            resp = self.client.messages.create(
                model=self.model,
                max_tokens=self.max_tokens,
                system=system,
                messages=[{"role": "user", "content": user}],
                tools=[tool],
                tool_choice={"type": "tool", "name": "emit"},
            )
        except anthropic.APIError as e:
            raise ProviderError(f"{type(e).__name__}: {e}") from e
        for block in resp.content:
            if block.type == "tool_use":
                return dict(block.input)
        raise ValueError("Model returned no structured output")  # retried by the caller

    def chat(self, *, task: str, system: str, messages: list[dict[str, str]]) -> str:
        try:
            resp = self.client.messages.create(
                model=self.model,
                max_tokens=self.max_tokens,
                system=system,
                messages=messages,
            )
        except anthropic.APIError as e:
            raise ProviderError(f"{type(e).__name__}: {e}") from e
        return "".join(b.text for b in resp.content if b.type == "text")
