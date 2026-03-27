from datetime import datetime
from sqlalchemy import create_engine, Column, Integer, String, Boolean, Text, Float, DateTime, ForeignKey
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()

### 1. ตารางข้อมูลร้านค้า ###
class Shop(Base):
    __tablename__ = 'shops'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    # ความสัมพันธ์ไปยังตารางอื่น (ให้ดึงข้อมูลง่ายขึ้น)
    subscriptions = relationship("ShopSubscription", back_populates="shop")
    promoted_post = relationship("PromotedPost", back_populates="shop", uselist=False)

### 2. ตารางแพ็กเกจ (ตั้งค่าโดยแอดมิน) ###
class Package(Base):
    __tablename__ = 'packages'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False) # เช่น "โปรโมท 30 วัน", "โปรโมทรายปี VIP"
    price = Column(Float, nullable=False)
    duration_days = Column(Integer, nullable=False) # จำนวนวันของแพ็กเกจ
    is_active = Column(Boolean, default=True) # เปิดขายอยู่หรือไม่

### 3. ตารางประวัติการซื้อแพ็กเกจ (ใช้เช็กสิทธิ์) ###
class ShopSubscription(Base):
    __tablename__ = 'shop_subscriptions'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    shop_id = Column(Integer, ForeignKey('shops.id'), nullable=False)
    package_id = Column(Integer, ForeignKey('packages.id'), nullable=False)
    
    start_date = Column(DateTime, default=datetime.utcnow)
    expire_date = Column(DateTime, nullable=False)
    status = Column(String(50), default='active') # สถานะ: 'active', 'expired'
    
    # ความสัมพันธ์
    shop = relationship("Shop", back_populates="subscriptions")
    package = relationship("Package")

### 4. ตารางข้อมูลโพสต์โปรโมท (จำกัด 3 รูป) ###
class PromotedPost(Base):
    __tablename__ = 'promoted_posts'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    shop_id = Column(Integer, ForeignKey('shops.id'), nullable=False, unique=True) # 1 ร้านมี 1 โพสต์โปรโมท
    details = Column(Text, nullable=True) # รายละเอียดโปรโมชั่น
    
    # เก็บ URL หรือชื่อไฟล์รูปภาพ สูงสุด 3 รูป
    image_1 = Column(String(255), nullable=True)
    image_2 = Column(String(255), nullable=True)
    image_3 = Column(String(255), nullable=True)
    
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # ความสัมพันธ์
    shop = relationship("Shop", back_populates="promoted_post")
