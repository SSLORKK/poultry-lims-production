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
    # Add hidden_indexes column to microbiology_coas table if table exists
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    if 'microbiology_coas' in inspector.get_table_names():
        columns = [col['name'] for col in inspector.get_columns('microbiology_coas')]
        if 'hidden_indexes' not in columns:
            op.add_column('microbiology_coas', sa.Column('hidden_indexes', sa.JSON(), nullable=True))


def downgrade():
    # Remove hidden_indexes column from microbiology_coas table
    op.drop_column('microbiology_coas', 'hidden_indexes')
