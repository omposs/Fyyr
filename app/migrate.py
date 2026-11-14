"""Tiny additive migration for SQLite: add columns that the models have but an older database file lacks.

This exists so that adding a column does not mean deleting bsp.db and re-profiling every company. It only ever
ADDs columns (always nullable) and their indexes. It never drops, renames or retypes anything. For anything beyond
that, or for Postgres, use Alembic.
"""
from __future__ import annotations

import logging

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine

from app.db import Base

log = logging.getLogger(__name__)


def ensure_columns(engine: Engine) -> list[str]:
    if engine.dialect.name != "sqlite":
        return []
    added: list[str] = []
    insp = inspect(engine)
    with engine.begin() as conn:
        for table in Base.metadata.sorted_tables:
            if not insp.has_table(table.name):
                continue  # create_all makes whole new tables
            have = {c["name"] for c in insp.get_columns(table.name)}
            for col in table.columns:
                if col.name in have:
                    continue
                ddl_type = col.type.compile(engine.dialect)
                conn.execute(text(f'ALTER TABLE "{table.name}" ADD COLUMN "{col.name}" {ddl_type}'))
                if col.unique or col.index:
                    unique = "UNIQUE " if col.unique else ""
                    conn.execute(text(f'CREATE {unique}INDEX IF NOT EXISTS "ix_{table.name}_{col.name}" '
                                      f'ON "{table.name}" ("{col.name}")'))
                added.append(f"{table.name}.{col.name}")
    if added:
        log.warning("Database upgraded, added columns: %s", ", ".join(added))
    return added
