"""Alembic environment.

The database URL and the target metadata both come from the application
itself rather than alembic.ini, so there is exactly one source of truth
for each: DATABASE_URL from app.db.database, and Base.metadata from the
models. Importing the model modules is what registers the tables on that
metadata — without those imports autogenerate would see an empty schema
and cheerfully generate a migration that drops every table.
"""
from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from app.db.database import DATABASE_URL, Base
from app.models import location, observation_log, observation_session, user  # noqa: F401

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Resolved at runtime so alembic.ini needs no credentials committed to the
# repo. A URL already set on the config wins, which lets callers point a
# migration run at another database (the test suite does this).
DB_URL = config.get_main_option("sqlalchemy.url") or DATABASE_URL
config.set_main_option("sqlalchemy.url", DB_URL)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Emit SQL to stdout instead of running it (alembic upgrade --sql)."""
    context.configure(
        url=DB_URL,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        # SQLite can't ALTER most things in place; batch mode rewrites the
        # table instead. Harmless on Postgres, essential for local dev.
        render_as_batch=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            render_as_batch=True,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
