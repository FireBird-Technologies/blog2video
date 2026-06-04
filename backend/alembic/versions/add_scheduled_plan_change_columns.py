"""add scheduled plan change columns to subscriptions

Revision ID: add_scheduled_plan_change
Revises: phase12_free_templates_download
Create Date: 2026-05-25

Adds three nullable columns to the subscriptions table to support
"downgrade scheduled at period end" via Stripe Subscription Schedules:

- scheduled_plan_id      FK to subscription_plans, target plan
- scheduled_change_at    when the change takes effect (= current_period_end at scheduling)
- stripe_schedule_id     the Stripe SubscriptionSchedule id for update/release calls
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "add_scheduled_plan_change"
down_revision: Union[str, None] = "phase12_free_templates_download"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "subscriptions",
        sa.Column("scheduled_plan_id", sa.Integer(), nullable=True),
    )
    op.add_column(
        "subscriptions",
        sa.Column("scheduled_change_at", sa.DateTime(), nullable=True),
    )
    op.add_column(
        "subscriptions",
        sa.Column("stripe_schedule_id", sa.String(length=255), nullable=True),
    )
    op.create_foreign_key(
        "fk_subscriptions_scheduled_plan_id_subscription_plans",
        "subscriptions",
        "subscription_plans",
        ["scheduled_plan_id"],
        ["id"],
    )
    op.create_index(
        "ix_subscriptions_stripe_schedule_id",
        "subscriptions",
        ["stripe_schedule_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_subscriptions_stripe_schedule_id", table_name="subscriptions")
    op.drop_constraint(
        "fk_subscriptions_scheduled_plan_id_subscription_plans",
        "subscriptions",
        type_="foreignkey",
    )
    op.drop_column("subscriptions", "stripe_schedule_id")
    op.drop_column("subscriptions", "scheduled_change_at")
    op.drop_column("subscriptions", "scheduled_plan_id")
