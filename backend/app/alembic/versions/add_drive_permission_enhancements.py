"""Add Drive permission enhancements

Revision ID: add_drive_permission_enhancements
Revises: add_user_security_fields
Create Date: 2026-01-02

This migration ensures the drive_permissions and drive_share_links tables exist
with all required columns and performance indexes.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision = 'add_drive_perm_enhance'
down_revision = 'add_drive_permissions'
branch_labels = None
depends_on = None


def table_exists(table_name):
    """Check if a table exists in the database"""
    bind = op.get_bind()
    inspector = inspect(bind)
    return table_name in inspector.get_table_names()


def index_exists(table_name, index_name):
    """Check if an index exists on a table"""
    bind = op.get_bind()
    inspector = inspect(bind)
    indexes = [idx['name'] for idx in inspector.get_indexes(table_name)]
    return index_name in indexes


def upgrade():
    """
    Create drive_permissions and drive_share_links tables if they don't exist.
    Add performance indexes for faster queries.
    """
    # Create drive_permissions table if it doesn't exist
    if not table_exists('drive_permissions'):
        op.create_table(
            'drive_permissions',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), unique=True, nullable=False),
            sa.Column('has_access', sa.Boolean(), server_default='false', nullable=False),
            sa.Column('permission_level', sa.String(20), server_default='read', nullable=False),
            sa.Column('folder_access', sa.JSON(), nullable=True),
            sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
            sa.Column('updated_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
            sa.Column('created_by', sa.String(255), nullable=True),
            sa.Column('updated_by', sa.String(255), nullable=True),
        )
        
        # Add performance indexes for drive_permissions
        op.create_index('ix_drive_permissions_user_id', 'drive_permissions', ['user_id'])
        op.create_index('ix_drive_permissions_has_access', 'drive_permissions', ['has_access'])
        op.create_index('ix_drive_permissions_user_access', 'drive_permissions', ['user_id', 'has_access'])
    else:
        # Table exists - add indexes if they don't exist
        if not index_exists('drive_permissions', 'ix_drive_permissions_user_id'):
            op.create_index('ix_drive_permissions_user_id', 'drive_permissions', ['user_id'])
        if not index_exists('drive_permissions', 'ix_drive_permissions_has_access'):
            op.create_index('ix_drive_permissions_has_access', 'drive_permissions', ['has_access'])
        if not index_exists('drive_permissions', 'ix_drive_permissions_user_access'):
            op.create_index('ix_drive_permissions_user_access', 'drive_permissions', ['user_id', 'has_access'])
    
    # Create drive_share_links table if it doesn't exist
    if not table_exists('drive_share_links'):
        op.create_table(
            'drive_share_links',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('drive_item_id', sa.Integer(), sa.ForeignKey('drive_items.id'), nullable=False),
            sa.Column('share_token', sa.String(64), unique=True, nullable=False),
            sa.Column('is_public', sa.Boolean(), server_default='false', nullable=False),
            sa.Column('requires_login', sa.Boolean(), server_default='true', nullable=False),
            sa.Column('allowed_users', sa.JSON(), nullable=True),
            sa.Column('expires_at', sa.DateTime(), nullable=True),
            sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
            sa.Column('created_by', sa.String(255), nullable=True),
            sa.Column('view_count', sa.Integer(), server_default='0'),
            sa.Column('last_accessed_at', sa.DateTime(), nullable=True),
            sa.Column('last_accessed_by', sa.String(255), nullable=True),
        )
        
        # Add performance indexes for drive_share_links
        op.create_index('ix_drive_share_links_drive_item_id', 'drive_share_links', ['drive_item_id'])
        op.create_index('ix_drive_share_links_share_token', 'drive_share_links', ['share_token'])
        op.create_index('ix_drive_share_links_expires_at', 'drive_share_links', ['expires_at'])
    else:
        # Table exists - add indexes if they don't exist
        if not index_exists('drive_share_links', 'ix_drive_share_links_drive_item_id'):
            op.create_index('ix_drive_share_links_drive_item_id', 'drive_share_links', ['drive_item_id'])
        if not index_exists('drive_share_links', 'ix_drive_share_links_share_token'):
            op.create_index('ix_drive_share_links_share_token', 'drive_share_links', ['share_token'])
        if not index_exists('drive_share_links', 'ix_drive_share_links_expires_at'):
            op.create_index('ix_drive_share_links_expires_at', 'drive_share_links', ['expires_at'])


def downgrade():
    """
    Remove performance indexes added by this migration.
    
    NOTE: We intentionally do NOT drop the tables to preserve data.
    If you need to completely remove Drive functionality, manually drop:
    - drive_share_links table
    - drive_permissions table
    """
    # Remove indexes from drive_permissions (if they exist)
    if table_exists('drive_permissions'):
        if index_exists('drive_permissions', 'ix_drive_permissions_user_access'):
            op.drop_index('ix_drive_permissions_user_access', 'drive_permissions')
        if index_exists('drive_permissions', 'ix_drive_permissions_has_access'):
            op.drop_index('ix_drive_permissions_has_access', 'drive_permissions')
        if index_exists('drive_permissions', 'ix_drive_permissions_user_id'):
            op.drop_index('ix_drive_permissions_user_id', 'drive_permissions')
    
    # Remove indexes from drive_share_links (if they exist)
    if table_exists('drive_share_links'):
        if index_exists('drive_share_links', 'ix_drive_share_links_expires_at'):
            op.drop_index('ix_drive_share_links_expires_at', 'drive_share_links')
        if index_exists('drive_share_links', 'ix_drive_share_links_share_token'):
            op.drop_index('ix_drive_share_links_share_token', 'drive_share_links')
        if index_exists('drive_share_links', 'ix_drive_share_links_drive_item_id'):
            op.drop_index('ix_drive_share_links_drive_item_id', 'drive_share_links')
