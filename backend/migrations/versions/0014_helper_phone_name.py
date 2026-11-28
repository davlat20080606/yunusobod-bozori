"""A helper's name next to the phone the owner writes in the cabinet (Shuhrat, 2026-11-28): the owner adds helpers
by their Telegram number without any QR; the helper scans the stall's sheet once and is in.

Revision ID: 0014
Revises: 0013
Create Date: 2026-11-28 12:00:00
"""
from alembic import op
import sqlalchemy as sa


revision = '0014'
down_revision = '0013'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('store_helper_phones', sa.Column('name', sa.String(100), nullable=True))


def downgrade():
    op.drop_column('store_helper_phones', 'name')
