"""add session detail fields

Revision ID: a8f30c1d4b72
Revises: f15102450276
Create Date: 2026-08-18
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a8f30c1d4b72"
down_revision: Union[str, Sequence[str], None] = "f15102450276"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("sessions", schema=None) as batch_op:
        batch_op.add_column(sa.Column("preparation_notes", sa.Text(), nullable=True))
    with op.batch_alter_table("observation_logs", schema=None) as batch_op:
        batch_op.add_column(sa.Column("equipment", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("exposure", sa.Text(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("observation_logs", schema=None) as batch_op:
        batch_op.drop_column("exposure")
        batch_op.drop_column("equipment")
    with op.batch_alter_table("sessions", schema=None) as batch_op:
        batch_op.drop_column("preparation_notes")
