"""dem so lan nhap sai otp

Revision ID: a1c0de000001
Revises: 70aea035bf3e
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'a1c0de000001'
down_revision: Union[str, Sequence[str], None] = '70aea035bf3e'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('email_otps', sa.Column('attempts', sa.Integer(), server_default='0', nullable=False))


def downgrade() -> None:
    op.drop_column('email_otps', 'attempts')
