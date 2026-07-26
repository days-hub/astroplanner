# app/db/migrations.py
#
# Bring the database schema up to date at startup, replacing the old
# Base.metadata.create_all(). That call created *missing tables* but never
# altered existing ones, so adding a column to a model left every already
# deployed database silently behind — which is exactly how the User.is_demo
# column ended up missing from both the dev SQLite file and the production
# Postgres database.
from __future__ import annotations

import logging
from pathlib import Path

from alembic import command
from alembic.config import Config
from alembic.runtime.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy import inspect

from app.db.database import engine

logger = logging.getLogger("astroplanner")

# backend/app/db/migrations.py -> backend/
BACKEND_ROOT = Path(__file__).resolve().parents[2]


def _alembic_config() -> Config:
    cfg = Config(str(BACKEND_ROOT / "alembic.ini"))
    # Absolute path so migrations work regardless of the process's cwd.
    cfg.set_main_option("script_location", str(BACKEND_ROOT / "alembic"))
    return cfg


def run_migrations() -> None:
    """Upgrade to head, adopting a pre-Alembic database if it predates it.

    A database created by the old create_all() has the tables but no
    alembic_version row, so a plain upgrade would try to CREATE TABLE over
    existing ones and fail. Those get stamped at the baseline instead —
    their schema already matches it — and pick up later migrations normally.
    """
    cfg = _alembic_config()

    with engine.connect() as conn:
        current = MigrationContext.configure(conn).get_current_revision()
        has_tables = inspect(conn).has_table("users")

    if current is None and has_tables:
        base_revision = ScriptDirectory.from_config(cfg).get_base()
        logger.info(
            "Existing pre-Alembic database detected; stamping baseline %s",
            base_revision,
        )
        command.stamp(cfg, base_revision)

    command.upgrade(cfg, "head")
    logger.info("Database schema is up to date")
