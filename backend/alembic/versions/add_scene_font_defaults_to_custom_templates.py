"""add scene_font_defaults to custom_templates and template_versions

Per-scene DEFAULT type sizes, shaped
    {"intro":   {"title": {"landscape": 72, "portrait": 52},
                 "description": {"landscape": 36, "portrait": 30}},
     "content": [{...}, ...],
     "outro":   {...}}
— the same indexing convention as scene_sample_content, image_box_aspect_ratios
and layout_prop_schemas.

Generated scene code carries its own literals today
(`props.titleFontSize ?? (isPortrait ? 52 : 76)`), chosen by the model and
unreachable afterwards: nothing could size a scene to the copy it actually
holds, and the editor's sliders had no defaults to start from. Computing the
sizes from the sample copy's length and storing them here makes them a template
property — visible in the preview, editable, and used by the render.

The {landscape, portrait} nesting is deliberate: it is the exact shape the
frontend's getDefaultFontSizesFromSchema and the backend's per-scene defaults
merge already resolve, so it needs no new resolution code on either side.

Mirrored onto template_versions for the same reason as the four metadata
columns beside it: a rollback must restore sizes that match the code it is
restoring, or one generation's type scale lands on another's layouts.

Nullable: templates generated before this stay NULL, every consumer falls
through to its existing default, and they pick sizes up on regeneration.

Revision ID: add_scene_font_defaults
Revises: add_scene_sample_content
Create Date: 2026-09-02 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "add_scene_font_defaults"
down_revision: Union[str, None] = "add_scene_sample_content"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "custom_templates",
        sa.Column("scene_font_defaults", sa.Text(), nullable=True),
    )
    op.add_column(
        "template_versions",
        sa.Column("scene_font_defaults", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("template_versions", "scene_font_defaults")
    op.drop_column("custom_templates", "scene_font_defaults")
