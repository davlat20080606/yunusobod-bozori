"""Counted stock: products the seller counts, what open orders hold, and a log of every move.

Revision ID: 0004
Revises: 0003
Create Date: 2026-10-30 19:37:07.991740
"""
from alembic import op
import sqlalchemy as sa


revision = '0004'
down_revision = '0003'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('stock_moves',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('product_id', sa.Integer(), nullable=False),
    sa.Column('order_id', sa.Integer(), nullable=True),
    sa.Column('kind', sa.String(length=20), nullable=False),
    sa.Column('quantity_delta', sa.Float(), nullable=False),
    sa.Column('reserved_delta', sa.Float(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['order_id'], ['orders.id'], ),
    sa.ForeignKeyConstraint(['product_id'], ['products.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('stock_moves', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_stock_moves_order_id'), ['order_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_stock_moves_product_id'), ['product_id'], unique=False)

    with op.batch_alter_table('order_items', schema=None) as batch_op:
        batch_op.add_column(sa.Column('stock_reserved_qty', sa.Float(), server_default='0', nullable=False))

    with op.batch_alter_table('products', schema=None) as batch_op:
        batch_op.add_column(sa.Column('track_stock', sa.Boolean(), server_default=sa.false(), nullable=False))
        batch_op.add_column(sa.Column('stock_reserved', sa.Float(), server_default='0', nullable=False))
        batch_op.add_column(sa.Column('low_stock_alert', sa.Float(), nullable=True))


def downgrade():
    with op.batch_alter_table('products', schema=None) as batch_op:
        batch_op.drop_column('low_stock_alert')
        batch_op.drop_column('stock_reserved')
        batch_op.drop_column('track_stock')

    with op.batch_alter_table('order_items', schema=None) as batch_op:
        batch_op.drop_column('stock_reserved_qty')

    with op.batch_alter_table('stock_moves', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_stock_moves_product_id'))
        batch_op.drop_index(batch_op.f('ix_stock_moves_order_id'))

    op.drop_table('stock_moves')
