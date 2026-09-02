from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database import Base

# ================= SQLAlchemy ORM Models =================

class CategoryModel(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    slug = Column(String(50), unique=True, index=True, nullable=False)
    name_uz = Column(String(100), nullable=False)
    name_ru = Column(String(100), nullable=False)
    name_en = Column(String(100), nullable=False)
    icon = Column(String(50), default="🥕")
    stall_area = Column(String(100), default="Rasta 1")

    stores = relationship("StoreModel", back_populates="category")


class StoreModel(Base):
    __tablename__ = "stores"

    id = Column(Integer, primary_key=True, index=True)
    slug = Column(String(100), unique=True, index=True, nullable=False)
    name_uz = Column(String(150), nullable=False)
    name_ru = Column(String(150), nullable=False)
    name_en = Column(String(150), nullable=False)
    stall_number = Column(String(50), nullable=False)
    owner_name = Column(String(100), nullable=False)
    owner_phone = Column(String(50), default="+998 90 123-45-67")
    telegram_chat_id = Column(String(50), nullable=True)
    seller_pin = Column(String(10), default="1234")
    category_slug = Column(String(50), ForeignKey("categories.slug"), nullable=False)
    avatar_url = Column(String(500), nullable=True)
    banner_url = Column(String(500), nullable=True)
    video_url = Column(String(500), nullable=True)
    description_uz = Column(Text, nullable=True)
    description_ru = Column(Text, nullable=True)
    description_en = Column(Text, nullable=True)
    is_open = Column(Boolean, default=True)
    rating = Column(Float, default=4.9)
    total_orders = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    category = relationship("CategoryModel", back_populates="stores")
    products = relationship("ProductModel", back_populates="store", cascade="all, delete-orphan")
    order_items = relationship("OrderItemModel", back_populates="store")


class ProductModel(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    store_id = Column(Integer, ForeignKey("stores.id"), nullable=False)
    category_slug = Column(String(50), nullable=False)
    name_uz = Column(String(150), nullable=False)
    name_ru = Column(String(150), nullable=False)
    name_en = Column(String(150), nullable=False)
    description_uz = Column(Text, nullable=True)
    description_ru = Column(Text, nullable=True)
    description_en = Column(Text, nullable=True)
    price = Column(Float, nullable=False)
    old_price = Column(Float, nullable=True)
    unit = Column(String(20), default="kg")
    min_weight = Column(Float, default=0.5)
    step_weight = Column(Float, default=0.5)
    image_url = Column(String(500), nullable=True)
    video_url = Column(String(500), nullable=True) # Direct MP4/WebM video reel
    is_available = Column(Boolean, default=True)
    is_featured = Column(Boolean, default=False)
    badge = Column(String(50), default="fresh")
    stock_quantity = Column(Float, default=100.0)
    created_at = Column(DateTime, default=datetime.utcnow)

    store = relationship("StoreModel", back_populates="products")
    order_items = relationship("OrderItemModel", back_populates="product")


class OrderModel(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    order_number = Column(String(30), unique=True, index=True, nullable=False)
    customer_name = Column(String(100), nullable=False)
    customer_phone = Column(String(50), nullable=False)
    customer_tg_id = Column(String(50), nullable=True)
    customer_tg_username = Column(String(100), nullable=True)
    delivery_address = Column(String(300), nullable=False)
    delivery_district = Column(String(100), default="Yunusobod")
    landmark = Column(String(200), nullable=True)
    delivery_time_slot = Column(String(100), default="Express (45-60 min)")
    payment_method = Column(String(50), default="cash")
    payment_status = Column(String(30), default="pending")
    status = Column(String(50), default="pending")
    total_amount = Column(Float, nullable=False)
    delivery_fee = Column(Float, default=15000.0)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    items = relationship("OrderItemModel", back_populates="order", cascade="all, delete-orphan")


class OrderItemModel(Base):
    __tablename__ = "order_items"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    store_id = Column(Integer, ForeignKey("stores.id"), nullable=False)
    product_name = Column(String(150), nullable=False)
    price = Column(Float, nullable=False)
    quantity = Column(Float, nullable=False)
    unit = Column(String(20), default="kg")
    total_price = Column(Float, nullable=False)
    is_picked = Column(Boolean, default=False)

    order = relationship("OrderModel", back_populates="items")
    product = relationship("ProductModel", back_populates="order_items")
    store = relationship("StoreModel", back_populates="order_items")


# ================= Pydantic Schemas =================

class CategorySchema(BaseModel):
    id: int
    slug: str
    name_uz: str
    name_ru: str
    name_en: str
    icon: str
    stall_area: str

    class Config:
        from_attributes = True


class ProductSchema(BaseModel):
    id: int
    store_id: int
    category_slug: str
    name_uz: str
    name_ru: str
    name_en: str
    description_uz: Optional[str] = None
    description_ru: Optional[str] = None
    description_en: Optional[str] = None
    price: float
    old_price: Optional[float] = None
    unit: str
    min_weight: float
    step_weight: float
    image_url: Optional[str] = None
    video_url: Optional[str] = None
    is_available: bool
    is_featured: bool
    badge: Optional[str] = None
    stock_quantity: float

    class Config:
        from_attributes = True


class StoreSchema(BaseModel):
    id: int
    slug: str
    name_uz: str
    name_ru: str
    name_en: str
    stall_number: str
    owner_name: str
    owner_phone: str
    category_slug: str
    avatar_url: Optional[str] = None
    banner_url: Optional[str] = None
    video_url: Optional[str] = None
    description_uz: Optional[str] = None
    description_ru: Optional[str] = None
    description_en: Optional[str] = None
    is_open: bool
    rating: float
    total_orders: int
    products_count: Optional[int] = 0

    class Config:
        from_attributes = True


class StoreWithProductsSchema(StoreSchema):
    products: List[ProductSchema] = []


class OrderItemCreateSchema(BaseModel):
    product_id: int
    store_id: int
    quantity: float


class OrderCreateSchema(BaseModel):
    customer_name: str
    customer_phone: str
    customer_tg_id: Optional[str] = None
    customer_tg_username: Optional[str] = None
    delivery_address: str
    delivery_district: str = "Yunusobod"
    landmark: Optional[str] = None
    delivery_time_slot: str = "Express (45-60 min)"
    payment_method: str = "cash"
    notes: Optional[str] = None
    items: List[OrderItemCreateSchema]


class OrderItemSchema(BaseModel):
    id: int
    product_id: int
    store_id: int
    product_name: str
    price: float
    quantity: float
    unit: str
    total_price: float
    is_picked: bool

    class Config:
        from_attributes = True


class OrderSchema(BaseModel):
    id: int
    order_number: str
    customer_name: str
    customer_phone: str
    customer_tg_id: Optional[str] = None
    delivery_address: str
    delivery_district: str
    landmark: Optional[str] = None
    delivery_time_slot: str
    payment_method: str
    payment_status: str
    status: str
    total_amount: float
    delivery_fee: float
    notes: Optional[str] = None
    created_at: datetime
    items: List[OrderItemSchema] = []

    class Config:
        from_attributes = True


class UpdatePriceSchema(BaseModel):
    price: float
    old_price: Optional[float] = None


class ToggleAvailabilitySchema(BaseModel):
    is_available: bool


class SellerLoginSchema(BaseModel):
    phone_or_slug: str
    pin: str


class ProductCreateSchema(BaseModel):
    name_uz: str
    name_ru: str
    category_slug: str
    price: float
    unit: str = "kg"
    min_weight: float = 0.5
    step_weight: float = 0.5
    image_url: Optional[str] = None
    video_url: Optional[str] = None
    description_uz: Optional[str] = None
    description_ru: Optional[str] = None
    badge: Optional[str] = "fresh"
    stock_quantity: float = 50.0


class StoreUpdateSchema(BaseModel):
    name_uz: Optional[str] = None
    name_ru: Optional[str] = None
    owner_name: Optional[str] = None
    owner_phone: Optional[str] = None
    stall_number: Optional[str] = None
    pin: Optional[str] = None
    description_uz: Optional[str] = None
    description_ru: Optional[str] = None


class StoreRegisterSchema(BaseModel):
    name_uz: str
    name_ru: str
    stall_number: str
    owner_name: str
    owner_phone: str
    category_slug: str
    pin: str
    description_uz: Optional[str] = None
    description_ru: Optional[str] = None



