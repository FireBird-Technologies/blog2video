"""carry generation metadata on template_versions

Fixes a real rollback bug. TemplateVersion snapshotted only the CODE
(intro/outro/content), so rolling back restored code while leaving
content_archetype_ids and image_box_aspect_ratios describing a DIFFERENT
generation. Symptoms: match_scenes_to_archetypes mapped content types to the
wrong variant indices, and the image-adjust modal showed the wrong aspect ratio.

Also adds the columns single-scene AI edits need (P4): kind distinguishes a
full-template snapshot from a one-scene draft, scene_role identifies which
scene, and is_draft marks a version that has not been applied yet.

All nullable / defaulted. Versions created before this migration keep NULL, and
rollback_to_version skips NULL fields rather than erasing the template's current
metadata.

Revision ID: add_template_version_metadata
Revises: add_layout_prop_schemas
Create Date: 2026-08-20 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "add_template_version_metadata"
down_revision: Union[str, None] = "add_layout_prop_schemas"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("template_versions", sa.Column("content_archetype_ids", sa.Text(), nullable=True))
    op.add_column("template_versions", sa.Column("image_box_aspect_ratios", sa.Text(), nullable=True))
    op.add_column("template_versions", sa.Column("design_blueprint", sa.Text(), nullable=True))
    op.add_column("template_versions", sa.Column("layout_prop_schemas", sa.Text(), nullable=True))
    op.add_column(
        "template_versions",
        sa.Column("kind", sa.String(32), nullable=False, server_default="full"),
    )
    op.add_column("template_versions", sa.Column("scene_role", sa.String(32), nullable=True))
    op.add_column(
        "template_versions",
        sa.Column("is_draft", sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column("template_versions", "is_draft")
    op.drop_column("template_versions", "scene_role")
    op.drop_column("template_versions", "kind")
    op.drop_column("template_versions", "layout_prop_schemas")
    op.drop_column("template_versions", "design_blueprint")
    op.drop_column("template_versions", "image_box_aspect_ratios")
    op.drop_column("template_versions", "content_archetype_ids")
