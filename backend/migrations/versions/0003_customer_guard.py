"""Customer guard: orders keep the phone's last 9 digits (limits, blocking), blocked customers.

Revision ID: 0003
Revises: 0002
Create Date: 2026-10-30 19:01:15.471789
"""
from alembic import op
import re

import sqlalchemy as sa


revision = '0003'
down_revision = '0002'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('customer_blocks',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('phone_key', sa.String(length=9), nullable=False),
    sa.Column('tg_id', sa.String(length=50), nullable=True),
    sa.Column('reason', sa.String(length=200), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('phone_key')
    )
    with op.batch_alter_table('customer_blocks', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_customer_blocks_tg_id'), ['tg_id'], unique=False)

    with op.batch_alter_table('orders', schema=None) as batch_op:
        batch_op.add_column(sa.Column('phone_key', sa.String(length=9), nullable=True))
        batch_op.create_index(batch_op.f('ix_orders_customer_tg_id'), ['customer_tg_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_orders_phone_key'), ['phone_key'], unique=False)

    # Orders made before this: same rule as app/services/customer_guard.phone_key
    conn = op.get_bind()
    orders = sa.table("orders", sa.column("id", sa.Integer), sa.column("customer_phone", sa.String), sa.column("phone_key", sa.String))
    for order_id, phone in conn.execute(sa.select(orders.c.id, orders.c.customer_phone)).all():
        digits = re.sub(r"\D", "", phone or "")
        if len(digits) >= 9:
            conn.execute(orders.update().where(orders.c.id == order_id).values(phone_key=digits[-9:]))


def downgrade():
    with op.batch_alter_table('orders', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_orders_phone_key'))
        batch_op.drop_index(batch_op.f('ix_orders_customer_tg_id'))
        batch_op.drop_column('phone_key')

    with op.batch_alter_table('customer_blocks', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_customer_blocks_tg_id'))
    op.drop_table('customer_blocks')
