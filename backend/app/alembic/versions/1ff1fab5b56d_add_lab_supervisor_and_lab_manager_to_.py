"""add_lab_supervisor_and_lab_manager_to_pcr_coa

Revision ID: 1ff1fab5b56d
Revises: eb0d7ae2d2e8
Create Date: 2025-10-24 16:53:36.677879

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '1ff1fab5b56d'
down_revision: Union[str, Sequence[str], None] = 'eb0d7ae2d2e8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('pcr_coa', sa.Column('lab_supervisor', sa.String(), nullable=True))
    op.add_column('pcr_coa', sa.Column('lab_manager', sa.String(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('pcr_coa', 'lab_manager')
    op.drop_column('pcr_coa', 'lab_supervisor')
