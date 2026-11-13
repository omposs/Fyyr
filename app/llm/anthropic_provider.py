from __future__ import annotations

from typing import Any

import anthropic


class AnthropicProvider:
    name = "anthropic"

    def __init__(self, api_key: str, model: str, max_tokens: int = 1500):
        self.client = anthropic.Anthropic(api_key=api_key)
        self.model = model
        self.max_tokens = max_tokens

    def structured(self, *, task: str, system: str, user: str, schema: dict[str, Any]) -> dict[str, Any]:
        # Forcing a tool call is the most reliable way to get schema-shaped JSON back.
        tool = {"name": "emit", "description": f"Return the result of task '{task}'.", "input_schema": schema}
        resp = self.client.messages.create(
            model=self.model,
            max_tokens=self.max_tokens,
            system=system,
            messages=[{"role": "user", "content": user}],
            tools=[tool],
            tool_choice={"type": "tool", "name": "emit"},
        )
        for block in resp.content:
            if block.type == "tool_use":
                return dict(block.input)
        raise RuntimeError("Model returned no structured output")

    def chat(self, *, task: str, system: str, messages: list[dict[str, str]]) -> str:
        resp = self.client.messages.create(
            model=self.model,
            max_tokens=self.max_tokens,
            system=system,
            messages=messages,
        )
        return "".join(b.text for b in resp.content if b.type == "text")
