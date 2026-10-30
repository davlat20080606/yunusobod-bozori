"""Order event log: every change to an order, who made it and when.

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-30 18:00:31.697887
"""
from alembic import op
import sqlalchemy as sa


revision = '0002'
down_revision = '0001'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('order_events',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('order_id', sa.Integer(), nullable=False),
    sa.Column('kind', sa.String(length=30), nullable=False),
    sa.Column('from_status', sa.String(length=50), nullable=True),
    sa.Column('to_status', sa.String(length=50), nullable=True),
    sa.Column('actor_role', sa.String(length=20), nullable=False),
    sa.Column('actor_id', sa.String(length=50), nullable=True),
    sa.Column('data', sa.JSON(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['order_id'], ['orders.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('order_events', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_order_events_created_at'), ['created_at'], unique=False)
        batch_op.create_index(batch_op.f('ix_order_events_order_id'), ['order_id'], unique=False)


def downgrade():
    with op.batch_alter_table('order_events', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_order_events_order_id'))
        batch_op.drop_index(batch_op.f('ix_order_events_created_at'))

    op.drop_table('order_events')
