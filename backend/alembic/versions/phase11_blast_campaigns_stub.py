"""Stub for phase11_blast_campaigns — exists in production DB but not locally.

Revision ID: phase11_blast_campaigns
Revises: template_change_jobs_cascade
Create Date: 2026-04-20
"""

from typing import Sequence, Union
from alembic import op


revision: str = "phase11_blast_campaigns"
down_revision: Union[str, None] = "template_change_jobs_cascade"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
