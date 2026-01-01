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
    # Check if pcr_coa table exists before adding columns
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    if 'pcr_coa' in inspector.get_table_names():
        # Check if columns already exist
        columns = [col['name'] for col in inspector.get_columns('pcr_coa')]
        if 'lab_supervisor' not in columns:
            op.add_column('pcr_coa', sa.Column('lab_supervisor', sa.String(), nullable=True))
        if 'lab_manager' not in columns:
            op.add_column('pcr_coa', sa.Column('lab_manager', sa.String(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('pcr_coa', 'lab_manager')
    op.drop_column('pcr_coa', 'lab_supervisor')
