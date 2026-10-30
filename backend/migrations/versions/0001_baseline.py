"""Baseline: the schema as it was when migrations were introduced.

Databases made before that are brought up to it by app/services/migrate.py and stamped.

Revision ID: 0001
Revises: 
Create Date: 2026-10-30 18:00:16.068283
"""
from alembic import op
import sqlalchemy as sa


revision = '0001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('categories',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('slug', sa.String(length=50), nullable=False),
    sa.Column('name_uz', sa.String(length=100), nullable=False),
    sa.Column('name_ru', sa.String(length=100), nullable=False),
    sa.Column('name_en', sa.String(length=100), nullable=False),
    sa.Column('icon', sa.String(length=50), nullable=True),
    sa.Column('stall_area', sa.String(length=100), nullable=True),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('categories', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_categories_id'), ['id'], unique=False)
        batch_op.create_index(batch_op.f('ix_categories_slug'), ['slug'], unique=True)

    op.create_table('customers',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('tg_id', sa.String(length=50), nullable=False),
    sa.Column('lang', sa.String(length=5), nullable=True),
    sa.Column('phone', sa.String(length=30), nullable=True),
    sa.Column('name', sa.String(length=100), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('customers', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_customers_id'), ['id'], unique=False)
        batch_op.create_index(batch_op.f('ix_customers_tg_id'), ['tg_id'], unique=True)

    op.create_table('media',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('filename', sa.String(length=100), nullable=False),
    sa.Column('content_type', sa.String(length=100), nullable=False),
    sa.Column('data', sa.LargeBinary(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('media', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_media_filename'), ['filename'], unique=True)
        batch_op.create_index(batch_op.f('ix_media_id'), ['id'], unique=False)

    op.create_table('orders',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('order_number', sa.String(length=30), nullable=False),
    sa.Column('customer_name', sa.String(length=100), nullable=False),
    sa.Column('customer_phone', sa.String(length=50), nullable=False),
    sa.Column('customer_tg_id', sa.String(length=50), nullable=True),
    sa.Column('customer_tg_username', sa.String(length=100), nullable=True),
    sa.Column('delivery_address', sa.String(length=300), nullable=False),
    sa.Column('delivery_district', sa.String(length=100), nullable=True),
    sa.Column('landmark', sa.String(length=200), nullable=True),
    sa.Column('delivery_lat', sa.Float(), nullable=True),
    sa.Column('delivery_lng', sa.Float(), nullable=True),
    sa.Column('delivery_time_slot', sa.String(length=100), nullable=True),
    sa.Column('payment_method', sa.String(length=50), nullable=True),
    sa.Column('payment_status', sa.String(length=30), nullable=True),
    sa.Column('status', sa.String(length=50), nullable=True),
    sa.Column('total_amount', sa.Float(), nullable=False),
    sa.Column('delivery_fee', sa.Float(), nullable=True),
    sa.Column('notes', sa.Text(), nullable=True),
    sa.Column('porter_name', sa.String(length=100), nullable=True),
    sa.Column('porter_phone', sa.String(length=50), nullable=True),
    sa.Column('porter_accepted_at', sa.DateTime(), nullable=True),
    sa.Column('taxi_name', sa.String(length=100), nullable=True),
    sa.Column('taxi_phone', sa.String(length=50), nullable=True),
    sa.Column('fulfillment', sa.String(length=20), nullable=True),
    sa.Column('handoff_point', sa.String(length=30), nullable=True),
    sa.Column('discount_amount', sa.Float(), nullable=True),
    sa.Column('customer_confirmed_at', sa.DateTime(), nullable=True),
    sa.Column('handoff_code', sa.String(length=6), nullable=True),
    sa.Column('handed_over_at', sa.DateTime(), nullable=True),
    sa.Column('taxi_eta_at', sa.DateTime(), nullable=True),
    sa.Column('cold_alert_sent', sa.Boolean(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('orders', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_orders_id'), ['id'], unique=False)
        batch_op.create_index(batch_op.f('ix_orders_order_number'), ['order_number'], unique=True)

    op.create_table('settings',
    sa.Column('key', sa.String(length=50), nullable=False),
    sa.Column('value', sa.String(length=200), nullable=False),
    sa.PrimaryKeyConstraint('key')
    )
    op.create_table('staff',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('role', sa.String(length=20), nullable=False),
    sa.Column('name', sa.String(length=100), nullable=False),
    sa.Column('phone', sa.String(length=50), nullable=False),
    sa.Column('pin', sa.String(length=10), nullable=False),
    sa.Column('status', sa.String(length=20), nullable=True),
    sa.Column('tg_id', sa.String(length=50), nullable=True),
    sa.Column('car', sa.String(length=100), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('staff', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_staff_id'), ['id'], unique=False)
        batch_op.create_index(batch_op.f('ix_staff_phone'), ['phone'], unique=False)

    op.create_table('reviews',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('order_id', sa.Integer(), nullable=False),
    sa.Column('rating', sa.Integer(), nullable=False),
    sa.Column('comment', sa.Text(), nullable=True),
    sa.Column('customer_name', sa.String(length=100), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['order_id'], ['orders.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('order_id')
    )
    with op.batch_alter_table('reviews', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_reviews_id'), ['id'], unique=False)

    op.create_table('stores',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('slug', sa.String(length=100), nullable=False),
    sa.Column('name_uz', sa.String(length=150), nullable=False),
    sa.Column('name_ru', sa.String(length=150), nullable=False),
    sa.Column('name_en', sa.String(length=150), nullable=False),
    sa.Column('stall_number', sa.String(length=50), nullable=False),
    sa.Column('owner_name', sa.String(length=100), nullable=False),
    sa.Column('owner_phone', sa.String(length=50), nullable=True),
    sa.Column('telegram_chat_id', sa.String(length=50), nullable=True),
    sa.Column('seller_pin', sa.String(length=10), nullable=True),
    sa.Column('category_slug', sa.String(length=50), nullable=False),
    sa.Column('avatar_url', sa.String(length=500), nullable=True),
    sa.Column('banner_url', sa.String(length=500), nullable=True),
    sa.Column('video_url', sa.String(length=500), nullable=True),
    sa.Column('description_uz', sa.Text(), nullable=True),
    sa.Column('description_ru', sa.Text(), nullable=True),
    sa.Column('description_en', sa.Text(), nullable=True),
    sa.Column('is_open', sa.Boolean(), nullable=True),
    sa.Column('status', sa.String(length=20), nullable=True),
    sa.Column('rating', sa.Float(), nullable=True),
    sa.Column('total_orders', sa.Integer(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['category_slug'], ['categories.slug'], ),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('stores', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_stores_id'), ['id'], unique=False)
        batch_op.create_index(batch_op.f('ix_stores_slug'), ['slug'], unique=True)

    op.create_table('order_bonuses',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('order_id', sa.Integer(), nullable=False),
    sa.Column('store_id', sa.Integer(), nullable=False),
    sa.Column('kind', sa.String(length=20), nullable=False),
    sa.Column('text', sa.String(length=200), nullable=True),
    sa.Column('text_ru', sa.String(length=200), nullable=True),
    sa.Column('text_en', sa.String(length=200), nullable=True),
    sa.Column('amount', sa.Float(), nullable=True),
    sa.ForeignKeyConstraint(['order_id'], ['orders.id'], ),
    sa.ForeignKeyConstraint(['store_id'], ['stores.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('order_bonuses', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_order_bonuses_id'), ['id'], unique=False)
        batch_op.create_index(batch_op.f('ix_order_bonuses_order_id'), ['order_id'], unique=False)

    op.create_table('patta_payments',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('store_id', sa.Integer(), nullable=False),
    sa.Column('day', sa.String(length=10), nullable=False),
    sa.Column('amount', sa.Float(), nullable=False),
    sa.Column('collector_id', sa.Integer(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['collector_id'], ['staff.id'], ),
    sa.ForeignKeyConstraint(['store_id'], ['stores.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('patta_payments', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_patta_payments_day'), ['day'], unique=False)
        batch_op.create_index(batch_op.f('ix_patta_payments_id'), ['id'], unique=False)

    op.create_table('products',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('store_id', sa.Integer(), nullable=False),
    sa.Column('category_slug', sa.String(length=50), nullable=False),
    sa.Column('name_uz', sa.String(length=150), nullable=False),
    sa.Column('name_ru', sa.String(length=150), nullable=False),
    sa.Column('name_en', sa.String(length=150), nullable=False),
    sa.Column('description_uz', sa.Text(), nullable=True),
    sa.Column('description_ru', sa.Text(), nullable=True),
    sa.Column('description_en', sa.Text(), nullable=True),
    sa.Column('price', sa.Float(), nullable=False),
    sa.Column('old_price', sa.Float(), nullable=True),
    sa.Column('unit', sa.String(length=20), nullable=True),
    sa.Column('min_weight', sa.Float(), nullable=True),
    sa.Column('step_weight', sa.Float(), nullable=True),
    sa.Column('image_url', sa.String(length=500), nullable=True),
    sa.Column('video_url', sa.String(length=500), nullable=True),
    sa.Column('is_available', sa.Boolean(), nullable=True),
    sa.Column('is_featured', sa.Boolean(), nullable=True),
    sa.Column('badge', sa.String(length=50), nullable=True),
    sa.Column('stock_quantity', sa.Float(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['store_id'], ['stores.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('products', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_products_id'), ['id'], unique=False)

    op.create_table('store_invites',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('token', sa.String(length=40), nullable=False),
    sa.Column('store_id', sa.Integer(), nullable=False),
    sa.Column('expires_at', sa.DateTime(), nullable=False),
    sa.Column('used_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['store_id'], ['stores.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('store_invites', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_store_invites_id'), ['id'], unique=False)
        batch_op.create_index(batch_op.f('ix_store_invites_token'), ['token'], unique=True)

    op.create_table('store_members',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('store_id', sa.Integer(), nullable=False),
    sa.Column('tg_id', sa.String(length=50), nullable=False),
    sa.Column('name', sa.String(length=100), nullable=True),
    sa.Column('role', sa.String(length=20), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['store_id'], ['stores.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('store_members', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_store_members_id'), ['id'], unique=False)
        batch_op.create_index(batch_op.f('ix_store_members_store_id'), ['store_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_store_members_tg_id'), ['tg_id'], unique=False)

    op.create_table('order_items',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('order_id', sa.Integer(), nullable=False),
    sa.Column('product_id', sa.Integer(), nullable=False),
    sa.Column('store_id', sa.Integer(), nullable=False),
    sa.Column('product_name', sa.String(length=150), nullable=False),
    sa.Column('price', sa.Float(), nullable=False),
    sa.Column('quantity', sa.Float(), nullable=False),
    sa.Column('unit', sa.String(length=20), nullable=True),
    sa.Column('total_price', sa.Float(), nullable=False),
    sa.Column('is_picked', sa.Boolean(), nullable=True),
    sa.Column('actual_quantity', sa.Float(), nullable=True),
    sa.Column('item_status', sa.String(length=20), nullable=True),
    sa.Column('weight_status', sa.String(length=20), nullable=True),
    sa.Column('weight_photo_url', sa.String(length=500), nullable=True),
    sa.Column('seller_ready', sa.Boolean(), nullable=True),
    sa.Column('seller_handed', sa.Boolean(), nullable=True),
    sa.ForeignKeyConstraint(['order_id'], ['orders.id'], ),
    sa.ForeignKeyConstraint(['product_id'], ['products.id'], ),
    sa.ForeignKeyConstraint(['store_id'], ['stores.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('order_items', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_order_items_id'), ['id'], unique=False)

    op.create_table('promos',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('store_id', sa.Integer(), nullable=False),
    sa.Column('kind', sa.String(length=20), nullable=False),
    sa.Column('min_amount', sa.Float(), nullable=False),
    sa.Column('percent', sa.Float(), nullable=True),
    sa.Column('amount', sa.Float(), nullable=True),
    sa.Column('gift_text', sa.String(length=150), nullable=True),
    sa.Column('gift_product_id', sa.Integer(), nullable=True),
    sa.Column('gift_qty', sa.Float(), nullable=True),
    sa.Column('is_active', sa.Boolean(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['gift_product_id'], ['products.id'], ),
    sa.ForeignKeyConstraint(['store_id'], ['stores.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('promos', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_promos_id'), ['id'], unique=False)
        batch_op.create_index(batch_op.f('ix_promos_store_id'), ['store_id'], unique=False)



def downgrade():
    with op.batch_alter_table('promos', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_promos_store_id'))
        batch_op.drop_index(batch_op.f('ix_promos_id'))

    op.drop_table('promos')
    with op.batch_alter_table('order_items', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_order_items_id'))

    op.drop_table('order_items')
    with op.batch_alter_table('store_members', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_store_members_tg_id'))
        batch_op.drop_index(batch_op.f('ix_store_members_store_id'))
        batch_op.drop_index(batch_op.f('ix_store_members_id'))

    op.drop_table('store_members')
    with op.batch_alter_table('store_invites', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_store_invites_token'))
        batch_op.drop_index(batch_op.f('ix_store_invites_id'))

    op.drop_table('store_invites')
    with op.batch_alter_table('products', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_products_id'))

    op.drop_table('products')
    with op.batch_alter_table('patta_payments', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_patta_payments_id'))
        batch_op.drop_index(batch_op.f('ix_patta_payments_day'))

    op.drop_table('patta_payments')
    with op.batch_alter_table('order_bonuses', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_order_bonuses_order_id'))
        batch_op.drop_index(batch_op.f('ix_order_bonuses_id'))

    op.drop_table('order_bonuses')
    with op.batch_alter_table('stores', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_stores_slug'))
        batch_op.drop_index(batch_op.f('ix_stores_id'))

    op.drop_table('stores')
    with op.batch_alter_table('reviews', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_reviews_id'))

    op.drop_table('reviews')
    with op.batch_alter_table('staff', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_staff_phone'))
        batch_op.drop_index(batch_op.f('ix_staff_id'))

    op.drop_table('staff')
    op.drop_table('settings')
    with op.batch_alter_table('orders', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_orders_order_number'))
        batch_op.drop_index(batch_op.f('ix_orders_id'))

    op.drop_table('orders')
    with op.batch_alter_table('media', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_media_id'))
        batch_op.drop_index(batch_op.f('ix_media_filename'))

    op.drop_table('media')
    with op.batch_alter_table('customers', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_customers_tg_id'))
        batch_op.drop_index(batch_op.f('ix_customers_id'))

    op.drop_table('customers')
    with op.batch_alter_table('categories', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_categories_slug'))
        batch_op.drop_index(batch_op.f('ix_categories_id'))

    op.drop_table('categories')
