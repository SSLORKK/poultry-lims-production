"""Add user security fields for account lockout and audit

Revision ID: add_user_security_fields
Revises: add_unit_edit_tracking
Create Date: 2026-01-02

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'add_user_security_fields'
down_revision = 'add_unit_edit_tracking'
branch_labels = None
depends_on = None


def upgrade():
    """Add security-related columns to users table"""
    # Add account lockout columns
    op.add_column('users', sa.Column('failed_login_attempts', sa.Integer(), nullable=True, server_default='0'))
    op.add_column('users', sa.Column('locked_until', sa.DateTime(), nullable=True))
    op.add_column('users', sa.Column('last_failed_login', sa.DateTime(), nullable=True))
    
    # Add audit columns
    op.add_column('users', sa.Column('created_at', sa.DateTime(), nullable=True, server_default=sa.text('CURRENT_TIMESTAMP')))
    op.add_column('users', sa.Column('last_login', sa.DateTime(), nullable=True))
    
    # Update existing rows to have default values
    op.execute("UPDATE users SET failed_login_attempts = 0 WHERE failed_login_attempts IS NULL")
    op.execute("UPDATE users SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL")
    
    # Make failed_login_attempts not nullable after setting defaults
    op.alter_column('users', 'failed_login_attempts', nullable=False)


def downgrade():
    """Remove security-related columns from users table"""
    op.drop_column('users', 'last_login')
    op.drop_column('users', 'created_at')
    op.drop_column('users', 'last_failed_login')
    op.drop_column('users', 'locked_until')
    op.drop_column('users', 'failed_login_attempts')
