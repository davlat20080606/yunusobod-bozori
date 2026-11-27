"""QR sheets printed before going to the bazaar (Shuhrat, 2026-11-26): each sheet holds an unguessable token, bound to
a stall at registration; helper phones written down at registration let helpers in without waiting for the owner.

Revision ID: 0013
Revises: 0012
Create Date: 2026-11-26 18:00:00
"""
from alembic import op
import sqlalchemy as sa


revision = '0013'
down_revision = '0012'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'vendor_kits',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('token', sa.String(40), nullable=False, unique=True, index=True),
        sa.Column('code', sa.String(20), nullable=False, unique=True, index=True),
        sa.Column('pin', sa.String(8), nullable=False),
        sa.Column('status', sa.String(20), nullable=False, server_default='unbound'),
        sa.Column('store_id', sa.Integer(), sa.ForeignKey('stores.id'), nullable=True, index=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('bound_at', sa.DateTime(), nullable=True),
        sa.Column('revoked_at', sa.DateTime(), nullable=True),
    )
    op.create_table(
        'store_helper_phones',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('store_id', sa.Integer(), sa.ForeignKey('stores.id'), nullable=False, index=True),
        sa.Column('phone', sa.String(20), nullable=False, index=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )


def downgrade():
    op.drop_table('store_helper_phones')
    op.drop_table('vendor_kits')
