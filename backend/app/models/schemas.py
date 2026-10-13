from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text, LargeBinary
from sqlalchemy.orm import relationship
from sqlalchemy import inspect as sa_inspect
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
    # pending → approved by the bazaar administration (bozorkom) → visible to customers
    status = Column(String(20), default="approved")
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

    def _loaded_store(self):
        # Only use the stall if the query loaded it (async sessions cannot lazy-load)
        return None if "store" in sa_inspect(self).unloaded else self.store

    @property
    def store_name_uz(self):
        store = self._loaded_store()
        return store.name_uz if store else None

    @property
    def store_name_ru(self):
        store = self._loaded_store()
        return store.name_ru if store else None

    @property
    def stall_number(self):
        store = self._loaded_store()
        return store.stall_number if store else None


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
    delivery_lat = Column(Float, nullable=True)
    delivery_lng = Column(Float, nullable=True)
    delivery_time_slot = Column(String(100), default="Express (45-60 min)")
    payment_method = Column(String(50), default="cash")
    payment_status = Column(String(30), default="pending")
    status = Column(String(50), default="pending")
    total_amount = Column(Float, nullable=False)
    delivery_fee = Column(Float, default=15000.0)
    notes = Column(Text, nullable=True)
    porter_name = Column(String(100), nullable=True)
    porter_phone = Column(String(50), nullable=True)
    porter_accepted_at = Column(DateTime, nullable=True)
    taxi_name = Column(String(100), nullable=True)
    taxi_phone = Column(String(50), nullable=True)
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


class ReviewModel(Base):
    """A customer's rating of a delivered order; it counts for every stall in that order."""
    __tablename__ = "reviews"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), unique=True, nullable=False)
    rating = Column(Integer, nullable=False)
    comment = Column(Text, nullable=True)
    customer_name = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class StaffModel(Base):
    """Bazaar workers: aravachi (porter), taksichi (courier), pattachi (stall-fee collector)."""
    __tablename__ = "staff"

    id = Column(Integer, primary_key=True, index=True)
    role = Column(String(20), nullable=False)  # porter | taxi | pattachi
    name = Column(String(100), nullable=False)
    phone = Column(String(50), nullable=False, index=True)
    pin = Column(String(10), nullable=False)
    status = Column(String(20), default="pending")  # pending | approved | blocked
    tg_id = Column(String(50), nullable=True)
    car = Column(String(100), nullable=True)  # taxi drivers: car and plate number
    created_at = Column(DateTime, default=datetime.utcnow)


class PattaPaymentModel(Base):
    """One stall-fee (patta) payment per stall per day."""
    __tablename__ = "patta_payments"

    id = Column(Integer, primary_key=True, index=True)
    store_id = Column(Integer, ForeignKey("stores.id"), nullable=False)
    day = Column(String(10), nullable=False, index=True)  # YYYY-MM-DD, Tashkent time
    amount = Column(Float, nullable=False)
    collector_id = Column(Integer, ForeignKey("staff.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class SettingModel(Base):
    """Values the bazaar administration can change without a new release."""
    __tablename__ = "settings"

    key = Column(String(50), primary_key=True)
    value = Column(String(200), nullable=False)


class MediaModel(Base):
    """Seller photos/videos kept in the database, so free cloud hosting does not lose them on restart."""
    __tablename__ = "media"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(100), unique=True, index=True, nullable=False)
    content_type = Column(String(100), nullable=False)
    data = Column(LargeBinary, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


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
    store_name_uz: Optional[str] = None
    store_name_ru: Optional[str] = None
    stall_number: Optional[str] = None

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
    reviews_count: int = 0
    status: str = "approved"

    class Config:
        from_attributes = True


class StoreWithProductsSchema(StoreSchema):
    products: List[ProductSchema] = []


class OrderItemCreateSchema(BaseModel):
    product_id: int
    store_id: int
    quantity: float = Field(..., gt=0, le=200)


class OrderCreateSchema(BaseModel):
    customer_name: str = Field(..., min_length=2, max_length=100)
    customer_phone: str = Field(..., min_length=9, max_length=50)
    customer_tg_id: Optional[str] = Field(None, max_length=50)
    customer_tg_username: Optional[str] = Field(None, max_length=100)
    delivery_address: str = Field(..., min_length=3, max_length=300)
    delivery_district: str = Field("Yunusobod", max_length=100)
    landmark: Optional[str] = Field(None, max_length=200)
    delivery_lat: Optional[float] = Field(None, ge=-90, le=90)
    delivery_lng: Optional[float] = Field(None, ge=-180, le=180)
    delivery_time_slot: str = Field("Express (45-60 min)", max_length=100)
    payment_method: str = Field("click", pattern=r"^(cash|click|payme)$")
    notes: Optional[str] = Field(None, max_length=1000)
    items: List[OrderItemCreateSchema] = Field(..., min_length=1, max_length=60)


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
    delivery_lat: Optional[float] = None
    delivery_lng: Optional[float] = None
    delivery_time_slot: str
    payment_method: str
    payment_status: str
    status: str
    total_amount: float
    delivery_fee: float
    notes: Optional[str] = None
    porter_name: Optional[str] = None
    porter_phone: Optional[str] = None
    taxi_name: Optional[str] = None
    taxi_phone: Optional[str] = None
    created_at: datetime
    items: List[OrderItemSchema] = []
    review_rating: Optional[int] = None

    class Config:
        from_attributes = True


class UpdatePriceSchema(BaseModel):
    price: float = Field(..., gt=0, le=100_000_000)
    old_price: Optional[float] = Field(None, ge=0, le=100_000_000)


class ToggleAvailabilitySchema(BaseModel):
    is_available: bool


class SellerLoginSchema(BaseModel):
    phone_or_slug: str = Field(..., max_length=100)
    pin: str = Field(..., max_length=10)


PIN_PATTERN = r"^\d{4,6}$"


class ProductCreateSchema(BaseModel):
    name_uz: str = Field(..., min_length=2, max_length=150)
    name_ru: str = Field("", max_length=150)
    category_slug: str = Field(..., max_length=50)
    price: float = Field(..., gt=0, le=100_000_000)
    unit: str = Field("kg", max_length=20)
    min_weight: float = Field(0.5, gt=0, le=1000)
    step_weight: float = Field(0.5, gt=0, le=1000)
    image_url: Optional[str] = Field(None, max_length=500)
    video_url: Optional[str] = Field(None, max_length=500)
    description_uz: Optional[str] = Field(None, max_length=2000)
    description_ru: Optional[str] = Field(None, max_length=2000)
    badge: Optional[str] = Field("fresh", max_length=50)
    stock_quantity: float = Field(50.0, ge=0, le=100000)


class StoreUpdateSchema(BaseModel):
    name_uz: Optional[str] = Field(None, min_length=2, max_length=150)
    name_ru: Optional[str] = Field(None, max_length=150)
    owner_name: Optional[str] = Field(None, min_length=2, max_length=100)
    owner_phone: Optional[str] = Field(None, max_length=50)
    stall_number: Optional[str] = Field(None, min_length=1, max_length=50)
    pin: Optional[str] = Field(None, pattern=PIN_PATTERN)
    description_uz: Optional[str] = Field(None, max_length=2000)
    description_ru: Optional[str] = Field(None, max_length=2000)


class StoreRegisterSchema(BaseModel):
    name_uz: str = Field(..., min_length=2, max_length=150)
    name_ru: str = Field("", max_length=150)
    stall_number: str = Field(..., min_length=1, max_length=50)
    owner_name: str = Field(..., min_length=2, max_length=100)
    owner_phone: str = Field(..., max_length=50)
    category_slug: str = Field(..., max_length=50)
    pin: str = Field(..., pattern=PIN_PATTERN)
    description_uz: Optional[str] = Field(None, max_length=2000)
    description_ru: Optional[str] = Field(None, max_length=2000)


class ReviewCreateSchema(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    comment: Optional[str] = Field(None, max_length=500)


class StaffRegisterSchema(BaseModel):
    role: str = Field(..., pattern=r"^(porter|taxi|pattachi)$")
    name: str = Field(..., min_length=2, max_length=100)
    phone: str = Field(..., max_length=50)
    pin: str = Field(..., pattern=PIN_PATTERN)
    car: Optional[str] = Field(None, max_length=100)


class StaffLoginSchema(BaseModel):
    phone: str = Field(..., max_length=50)
    pin: str = Field(..., max_length=10)
