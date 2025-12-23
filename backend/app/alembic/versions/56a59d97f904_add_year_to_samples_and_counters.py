"""add_year_to_samples_and_counters

Revision ID: 56a59d97f904
Revises: 902aff2801fa
Create Date: 2025-10-25 10:45:04.366355

"""
from typing import Sequence, Union
from datetime import datetime

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '56a59d97f904'
down_revision: Union[str, Sequence[str], None] = 'b0104fd427d2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    current_year = datetime.now().year
    
    # Add year column to samples table with temporary nullable
    op.add_column('samples', sa.Column('year', sa.Integer(), nullable=True))
    
    # Backfill year from created_at timestamp for existing samples
    # Extract year from created_at field to preserve historical data
    op.execute("""
        UPDATE samples 
        SET year = EXTRACT(YEAR FROM created_at)
        WHERE year IS NULL
    """)
    
    # Now make year non-nullable
    op.alter_column('samples', 'year', nullable=False)
    op.create_index(op.f('ix_samples_year'), 'samples', ['year'], unique=False)
    
    # Add year column to counters table with temporary nullable
    op.add_column('counters', sa.Column('year', sa.Integer(), nullable=True))
    
    # Backfill counters with current year (counters don't have historical significance)
    op.execute(f"""
        UPDATE counters 
        SET year = {current_year}
        WHERE year IS NULL
    """)
    
    # Now make year non-nullable for counters
    op.alter_column('counters', 'year', nullable=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('counters', 'year')
    op.drop_index(op.f('ix_samples_year'), table_name='samples')
    op.drop_column('samples', 'year')
