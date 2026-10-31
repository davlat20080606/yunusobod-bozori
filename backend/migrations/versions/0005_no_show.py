"""«Xaridor kelmadi»: when the customer started being waited for, the no-show itself, the goods' return.

Revision ID: 0005
Revises: 0004
Create Date: 2026-10-31 12:00:00
"""
from alembic import op
import sqlalchemy as sa


revision = '0005'
down_revision = '0004'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('orders', schema=None) as batch_op:
        batch_op.add_column(sa.Column('waiting_since', sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column('wait_reminded', sa.Boolean(), server_default=sa.false(), nullable=False))
        batch_op.add_column(sa.Column('no_show_at', sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column('no_show_fee', sa.Float(), nullable=True))
        batch_op.add_column(sa.Column('no_show_forgiven', sa.Boolean(), server_default=sa.false(), nullable=False))
        batch_op.add_column(sa.Column('return_alert_sent', sa.Boolean(), server_default=sa.false(), nullable=False))
        batch_op.add_column(sa.Column('returned_at', sa.DateTime(), nullable=True))

    with op.batch_alter_table('order_items', schema=None) as batch_op:
        batch_op.add_column(sa.Column('returned', sa.Boolean(), server_default=sa.false(), nullable=False))


def downgrade():
    with op.batch_alter_table('order_items', schema=None) as batch_op:
        batch_op.drop_column('returned')

    with op.batch_alter_table('orders', schema=None) as batch_op:
        for column in ('returned_at', 'return_alert_sent', 'no_show_forgiven', 'no_show_fee', 'no_show_at', 'wait_reminded', 'waiting_since'):
            batch_op.drop_column(column)
