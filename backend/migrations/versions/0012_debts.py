"""📒 Nasiya daftari: each stall's own notebook of goods given on credit, confirmed by the buyer in the bot.

Revision ID: 0012
Revises: 0011
Create Date: 2026-11-21 10:00:00
"""
from alembic import op
import sqlalchemy as sa


revision = '0012'
down_revision = '0011'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'debts',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('store_id', sa.Integer(), sa.ForeignKey('stores.id'), nullable=False, index=True),
        sa.Column('customer_name', sa.String(100), nullable=False),
        sa.Column('customer_phone', sa.String(30), nullable=True),
        sa.Column('customer_tg_id', sa.String(50), nullable=True, index=True),
        sa.Column('amount', sa.Integer(), nullable=False),
        sa.Column('paid', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('note', sa.String(200), nullable=True),
        sa.Column('due_date', sa.Date(), nullable=False),
        sa.Column('status', sa.String(20), nullable=False, server_default='open'),
        sa.Column('confirm', sa.String(20), nullable=False, server_default='none'),
        sa.Column('cancel_reason', sa.String(200), nullable=True),
        sa.Column('order_id', sa.Integer(), sa.ForeignKey('orders.id'), nullable=True),
        sa.Column('reminders_off', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('reminded_on', sa.Date(), nullable=True),
        sa.Column('paid_claim_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('closed_at', sa.DateTime(), nullable=True),
    )
    op.create_table(
        'debt_events',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('debt_id', sa.Integer(), sa.ForeignKey('debts.id'), nullable=False, index=True),
        sa.Column('kind', sa.String(20), nullable=False),
        sa.Column('amount', sa.Integer(), nullable=True),
        sa.Column('note', sa.String(200), nullable=True),
        sa.Column('actor', sa.String(20), nullable=False, server_default='seller'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )


def downgrade():
    op.drop_table('debt_events')
    op.drop_table('debts')
