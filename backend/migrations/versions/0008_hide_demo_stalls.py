"""Hide the demo stalls that came with the first empty database (Davlatbek, 13 Nov 2026: the bozorkom sees only real
stalls). A demo stall is one with its demo name and its demo owner phone; a stall the bazaar re-used is left alone.
Hidden, not deleted: status «archived», so old test orders keep their lines and the downgrade brings them back.

Revision ID: 0008
Revises: 0007
Create Date: 2026-11-13 20:00:00
"""
from alembic import op
import sqlalchemy as sa


revision = '0008'
down_revision = '0007'
branch_labels = None
depends_on = None

DEMO = {
    "dilshod-ota-sabzavot": "+998 90 111-22-33",
    "karen-aka-gosht": "+998 93 222-33-44",
    "zuhra-opa-tandir": "+998 97 333-44-55",
    "akmal-quruq-meva": "+998 94 444-55-66",
    "botir-aka-mevalar": "+998 99 555-66-77",
    "nodira-opa-sut": "+998 91 666-77-88",
}


def upgrade():
    stores = sa.table("stores", sa.column("slug", sa.String), sa.column("owner_phone", sa.String), sa.column("status", sa.String))
    for slug, phone in DEMO.items():
        op.execute(stores.update().where(stores.c.slug == slug).where(stores.c.owner_phone == phone).values(status="archived"))


def downgrade():
    stores = sa.table("stores", sa.column("slug", sa.String), sa.column("owner_phone", sa.String), sa.column("status", sa.String))
    for slug, phone in DEMO.items():
        op.execute(stores.update().where(stores.c.slug == slug).where(stores.c.owner_phone == phone)
                   .where(stores.c.status == "archived").values(status="approved"))
