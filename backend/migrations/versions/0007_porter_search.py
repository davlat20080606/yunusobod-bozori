"""Aravachi search limit: until when the customer waits for an aravachi before choosing what to do.

Revision ID: 0007
Revises: 0006
Create Date: 2026-11-11 10:00:00
"""
from alembic import op
import sqlalchemy as sa


revision = '0007'
down_revision = '0006'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('orders', schema=None) as batch_op:
        batch_op.add_column(sa.Column('search_until', sa.DateTime(), nullable=True))


def downgrade():
    with op.batch_alter_table('orders', schema=None) as batch_op:
        batch_op.drop_column('search_until')
