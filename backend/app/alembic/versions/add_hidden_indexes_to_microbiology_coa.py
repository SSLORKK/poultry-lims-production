"""Add hidden_indexes column to microbiology_coas table

Revision ID: add_hidden_indexes_mic
Revises: 
Create Date: 2024-12-27

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_hidden_indexes_mic'
down_revision = '902aff2801fa'
branch_labels = None
depends_on = None


def upgrade():
    # Add hidden_indexes column to microbiology_coas table
    op.add_column('microbiology_coas', sa.Column('hidden_indexes', sa.JSON(), nullable=True))


def downgrade():
    # Remove hidden_indexes column from microbiology_coas table
    op.drop_column('microbiology_coas', 'hidden_indexes')
