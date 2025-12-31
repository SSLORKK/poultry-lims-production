"""Add drive permissions and share links tables

Revision ID: add_drive_permissions
Revises: add_technician_to_serology
Create Date: 2024-12-31

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'add_drive_permissions'
down_revision = 'add_tech_serology'
branch_labels = None
depends_on = None


def upgrade():
    # Create drive_permissions table
    op.create_table(
        'drive_permissions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('has_access', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('permission_level', sa.String(20), nullable=False, server_default='read'),
        sa.Column('folder_access', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('created_by', sa.String(255), nullable=True),
        sa.Column('updated_by', sa.String(255), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_drive_permissions_id', 'drive_permissions', ['id'])
    op.create_index('ix_drive_permissions_user_id', 'drive_permissions', ['user_id'], unique=True)
    
    # Create drive_share_links table
    op.create_table(
        'drive_share_links',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('drive_item_id', sa.Integer(), nullable=False),
        sa.Column('share_token', sa.String(64), nullable=False),
        sa.Column('is_public', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('requires_login', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('allowed_users', sa.JSON(), nullable=True),
        sa.Column('expires_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('created_by', sa.String(255), nullable=True),
        sa.Column('view_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('last_accessed_at', sa.DateTime(), nullable=True),
        sa.Column('last_accessed_by', sa.String(255), nullable=True),
        sa.ForeignKeyConstraint(['drive_item_id'], ['drive_items.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_drive_share_links_id', 'drive_share_links', ['id'])
    op.create_index('ix_drive_share_links_drive_item_id', 'drive_share_links', ['drive_item_id'])
    op.create_index('ix_drive_share_links_share_token', 'drive_share_links', ['share_token'], unique=True)


def downgrade():
    op.drop_table('drive_share_links')
    op.drop_table('drive_permissions')
