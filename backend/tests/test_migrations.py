"""Alembic migrations: real upgrade path, and drift against the models.

The drift test is the important one. `create_all()` used to create missing
tables but never alter existing ones, so a new column on a model left every
deployed database silently behind (this is how User.is_demo went missing from
both the dev SQLite file and production Postgres). Migrations fix that only
if they stay in step with the models — so this asserts they do.
"""
import os

import pytest
from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.migration import MigrationContext
from sqlalchemy import create_engine, inspect

from app.db.database import Base
from app.db.migrations import BACKEND_ROOT
from app.models import (  # noqa: F401 - registers tables on Base.metadata
    location,
    observation_log,
    observation_session,
    user,
)

EXPECTED_TABLES = {"users", "locations", "sessions", "observation_logs"}


def _config_for(url: str) -> Config:
    cfg = Config(str(BACKEND_ROOT / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_ROOT / "alembic"))
    cfg.set_main_option("sqlalchemy.url", url)
    return cfg


@pytest.fixture()
def migrated_db(tmp_path):
    """A temp-file SQLite database upgraded to head by real Alembic.

    env.py honours a URL set on the config, so the migration runs against
    this temp file rather than the developer's actual database.
    """
    url = f"sqlite:///{tmp_path / 'migrated.db'}"
    engine = create_engine(url)
    command.upgrade(_config_for(url), "head")
    yield engine
    engine.dispose()


class TestMigrationPath:
    def test_upgrade_creates_full_schema(self, migrated_db):
        tables = set(inspect(migrated_db).get_table_names())
        assert EXPECTED_TABLES <= tables
        assert "alembic_version" in tables

    def test_is_demo_column_present(self, migrated_db):
        """The column whose absence broke two databases before migrations."""
        cols = {c["name"] for c in inspect(migrated_db).get_columns("users")}
        assert "is_demo" in cols

    def test_downgrade_is_reversible(self, migrated_db, tmp_path):
        url = str(migrated_db.url)
        command.downgrade(_config_for(url), "base")
        remaining = set(inspect(migrated_db).get_table_names())
        assert not (EXPECTED_TABLES & remaining)


class TestNoModelDrift:
    def test_migrations_match_models(self, migrated_db):
        """Autogenerate must find nothing left to do.

        If this fails, a model was changed without a matching migration —
        run `alembic revision --autogenerate -m "..."` and commit the result.
        """
        with migrated_db.connect() as conn:
            ctx = MigrationContext.configure(
                conn, opts={"compare_type": True, "render_as_batch": True}
            )
            diff = compare_metadata(ctx, Base.metadata)

        assert diff == [], (
            "Schema drift between models and migrations:\n"
            + "\n".join(f"  {d}" for d in diff)
        )
