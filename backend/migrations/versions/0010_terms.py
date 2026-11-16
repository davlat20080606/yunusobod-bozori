"""Platform rules: who accepted which version, when, and where.

Revision ID: 0010
Revises: 0009
Create Date: 2026-11-16 10:00:00
"""
from alembic import op
import sqlalchemy as sa


revision = '0010'
down_revision = '0009'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'terms_acceptances',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('tg_id', sa.String(50), nullable=False),
        sa.Column('version', sa.String(20), nullable=False),
        sa.Column('lang', sa.String(5), nullable=True),
        sa.Column('source', sa.String(10), nullable=True),
        sa.Column('accepted_at', sa.DateTime(), nullable=True),
    )
    op.create_index('ix_terms_acceptances_tg_id', 'terms_acceptances', ['tg_id'])


def downgrade():
    op.drop_index('ix_terms_acceptances_tg_id', 'terms_acceptances')
    op.drop_table('terms_acceptances')
