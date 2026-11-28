"""👥 A stall's own customers (Shuhrat, 2026-11-28): the seller's list of regulars (name, phone, note), filled by
hand and by the nasiya notebook; a personal invite QR per customer; buyers who came by the stall's invite link.

Revision ID: 0015
Revises: 0014
Create Date: 2026-11-28 15:00:00
"""
from alembic import op
import sqlalchemy as sa


revision = '0015'
down_revision = '0014'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'stall_clients',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('store_id', sa.Integer(), sa.ForeignKey('stores.id'), nullable=False, index=True),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('phone', sa.String(20), nullable=True, index=True),
        sa.Column('note', sa.String(200), nullable=True),
        sa.Column('tg_id', sa.String(50), nullable=True, index=True),
        sa.Column('invite_token', sa.String(40), nullable=True, unique=True),
        sa.Column('source', sa.String(20), nullable=False, server_default='manual'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )


def downgrade():
    op.drop_table('stall_clients')
