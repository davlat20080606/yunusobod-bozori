"""Taxi control: when the taxi took the order and left the bazaar, how often it was given to another taxi,
where the taxi is now, and the drivers' incidents (late to the gate, late delivery, gave the order back).

Revision ID: 0006
Revises: 0005
Create Date: 2026-11-01 10:00:00
"""
from alembic import op
import sqlalchemy as sa


revision = '0006'
down_revision = '0005'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('orders', schema=None) as batch_op:
        batch_op.add_column(sa.Column('taxi_taken_at', sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column('left_bazaar_at', sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column('taxi_reassign_count', sa.Integer(), server_default='0', nullable=False))
        batch_op.add_column(sa.Column('taxi_lat', sa.Float(), nullable=True))
        batch_op.add_column(sa.Column('taxi_lng', sa.Float(), nullable=True))
        batch_op.add_column(sa.Column('taxi_loc_at', sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column('late_alert_sent', sa.Boolean(), server_default=sa.false(), nullable=False))

    op.create_table(
        'staff_incidents',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('staff_id', sa.Integer(), sa.ForeignKey('staff.id'), nullable=False, index=True),
        sa.Column('order_id', sa.Integer(), sa.ForeignKey('orders.id'), nullable=True),
        sa.Column('kind', sa.String(30), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )


def downgrade():
    op.drop_table('staff_incidents')
    with op.batch_alter_table('orders', schema=None) as batch_op:
        for column in ('late_alert_sent', 'taxi_loc_at', 'taxi_lng', 'taxi_lat', 'taxi_reassign_count', 'left_bazaar_at', 'taxi_taken_at'):
            batch_op.drop_column(column)
