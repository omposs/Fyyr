"""Split long documents so each model call stays well inside context limits.

Chunks overlap a little so a fact that straddles a boundary is seen whole by at least one chunk.
Breaks prefer paragraph, then sentence, then whitespace boundaries.
"""
from __future__ import annotations


def chunk_text(text: str, size: int = 12000, overlap: int = 500) -> list[str]:
    if size <= 0:
        raise ValueError("size must be positive")
    overlap = max(0, min(overlap, size // 2))
    text = text.strip()
    if len(text) <= size:
        return [text] if text else []
    chunks: list[str] = []
    start = 0
    while start < len(text):
        end = min(start + size, len(text))
        if end < len(text):
            window_start = start + int(size * 0.7)  # only break in the last 30% of the window
            cut = -1
            for sep in ("\n\n", ". ", "\n", " "):
                cut = text.rfind(sep, window_start, end)
                if cut != -1:
                    end = cut + len(sep)
                    break
        chunks.append(text[start:end].strip())
        if end >= len(text):
            break
        start = max(end - overlap, start + 1)  # always advance
    return [c for c in chunks if c]
