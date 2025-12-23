"""add_profile_picture_to_users

Revision ID: b0104fd427d2
Revises: 56a59d97f904
Create Date: 2025-10-30 11:04:21.211314

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b0104fd427d2'
down_revision: Union[str, Sequence[str], None] = '9c0de2b30db8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('users', sa.Column('profile_picture', sa.String(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('users', 'profile_picture')
