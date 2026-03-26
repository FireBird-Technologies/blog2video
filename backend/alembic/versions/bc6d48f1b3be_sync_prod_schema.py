"""sync_prod_schema

Revision ID: bc6d48f1b3be
Revises: 57640a829335
Create Date: 2026-02-28 21:09:22.707857

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'bc6d48f1b3be'
down_revision: Union[str, None] = '57640a829335'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    custom_templates_exists = inspector.has_table('custom_templates')
    if not custom_templates_exists:
        op.create_table('custom_templates',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('source_url', sa.String(length=2048), nullable=True),
        sa.Column('category', sa.String(length=50), nullable=False),
        sa.Column('supported_video_style', sa.String(length=30), nullable=False),
        sa.Column('theme', sa.Text(), nullable=False),
        sa.Column('generated_prompt', sa.Text(), nullable=True),
        sa.Column('preview_image_url', sa.String(length=2048), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
        )

    custom_templates_indexes = {
        idx['name'] for idx in inspector.get_indexes('custom_templates')
    } if inspector.has_table('custom_templates') else set()
    custom_templates_user_idx = op.f('ix_custom_templates_user_id')
    if custom_templates_user_idx not in custom_templates_indexes:
        op.create_index(custom_templates_user_idx, 'custom_templates', ['user_id'], unique=False)

    project_columns = {col['name'] for col in inspector.get_columns('projects')}
    if 'logo_size' not in project_columns:
        # Add defaults so existing rows in older DBs receive a value.
        op.add_column('projects', sa.Column('logo_size', sa.Float(), server_default='100.0', nullable=False))
    if 'video_style' not in project_columns:
        op.add_column('projects', sa.Column('video_style', sa.String(length=30), server_default="'explainer'", nullable=False))

    if 'template' in project_columns:
        op.execute("UPDATE projects SET template = 'default' WHERE template IS NULL")
        op.alter_column('projects', 'template',
                   existing_type=sa.VARCHAR(length=50),
                   nullable=False)
    if 'ai_assisted_editing_count' in project_columns:
        op.execute("UPDATE projects SET ai_assisted_editing_count = 0 WHERE ai_assisted_editing_count IS NULL")
        op.alter_column('projects', 'ai_assisted_editing_count',
                   existing_type=sa.INTEGER(),
                   nullable=False)

    scene_columns = {col['name'] for col in inspector.get_columns('scenes')}
    if 'display_text' not in scene_columns:
        op.add_column('scenes', sa.Column('display_text', sa.Text(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if inspector.has_table('scenes'):
        scene_columns = {col['name'] for col in inspector.get_columns('scenes')}
        if 'display_text' in scene_columns:
            op.drop_column('scenes', 'display_text')

    if inspector.has_table('projects'):
        project_columns = {col['name'] for col in inspector.get_columns('projects')}
        if 'ai_assisted_editing_count' in project_columns:
            op.alter_column('projects', 'ai_assisted_editing_count',
                       existing_type=sa.INTEGER(),
                       server_default=sa.text('0'),
                       nullable=True)
        op.alter_column('projects', 'aspect_ratio',
                   existing_type=sa.VARCHAR(length=20),
                   server_default=sa.text("'landscape'::character varying"),
                   existing_nullable=False)
        if 'template' in project_columns:
            op.alter_column('projects', 'template',
                       existing_type=sa.VARCHAR(length=50),
                       server_default=sa.text("'default'::character varying"),
                       nullable=True)
        op.alter_column('projects', 'logo_opacity',
                   existing_type=sa.DOUBLE_PRECISION(precision=53),
                   server_default=sa.text('0.9'),
                   existing_nullable=False)
        op.alter_column('projects', 'logo_position',
                   existing_type=sa.VARCHAR(length=20),
                   server_default=sa.text("'bottom_right'::character varying"),
                   existing_nullable=False)
        if 'video_style' in project_columns:
            op.drop_column('projects', 'video_style')
        if 'logo_size' in project_columns:
            op.drop_column('projects', 'logo_size')

    if inspector.has_table('custom_templates'):
        custom_templates_indexes = {
            idx['name'] for idx in inspector.get_indexes('custom_templates')
        }
        custom_templates_user_idx = op.f('ix_custom_templates_user_id')
        if custom_templates_user_idx in custom_templates_indexes:
            op.drop_index(custom_templates_user_idx, table_name='custom_templates')
        op.drop_table('custom_templates')
