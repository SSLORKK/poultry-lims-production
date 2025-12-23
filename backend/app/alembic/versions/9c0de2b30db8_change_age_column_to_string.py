"""change_age_column_to_string

Revision ID: 9c0de2b30db8
Revises: b0104fd427d2
Create Date: 2025-11-02 14:40:18.052608

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9c0de2b30db8'
down_revision: Union[str, Sequence[str], None] = 'add_extraction_detection'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Change age column from Integer to String."""
    # Change column type from Integer to String using USING clause for PostgreSQL
    op.alter_column('units', 'age',
                    existing_type=sa.Integer(),
                    type_=sa.String(),
                    existing_nullable=True,
                    postgresql_using='age::varchar')


def downgrade() -> None:
    """Revert age column back to Integer."""
    # Change column type from String back to Integer
    # Note: This will fail if there are non-numeric string values
    op.alter_column('units', 'age',
                    existing_type=sa.String(),
                    type_=sa.Integer(),
                    existing_nullable=True,
                    postgresql_using='age::integer')
