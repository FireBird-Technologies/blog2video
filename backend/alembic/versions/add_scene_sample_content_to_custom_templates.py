"""add scene_sample_content to custom_templates and template_versions

Representative on-screen copy per scene, generated once when the template is
built and shaped {"intro": {...}, "content": [{...}, ...], "outro": {...}} — the
same indexing convention as image_box_aspect_ratios and layout_prop_schemas.

Preview copy used to be synthesised in the browser on every render, so it was
generic ("Our Brand", "Scene 2"), never reflected the template's own subject
matter, and could be neither inspected nor edited. Generating it against each
scene's design document gives the gallery and the editor copy that belongs to
the template.

Mirrored onto template_versions for the same reason the four metadata columns
beside it are: it is indexed in lockstep with content_codes, so a rollback that
restored the code without it would render one generation's copy over another
generation's layouts.

Nullable: templates generated before this stay NULL and the frontend falls back
to the client-side sample generator exactly as it does today.

Revision ID: add_scene_sample_content
Revises: staged_codegen_runs
Create Date: 2026-09-02 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "add_scene_sample_content"
down_revision: Union[str, None] = "staged_codegen_runs"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "custom_templates",
        sa.Column("scene_sample_content", sa.Text(), nullable=True),
    )
    op.add_column(
        "template_versions",
        sa.Column("scene_sample_content", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("template_versions", "scene_sample_content")
    op.drop_column("custom_templates", "scene_sample_content")
