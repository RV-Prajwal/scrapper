from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import (
    Column,
    DateTime,
    Float,
    Integer,
    MetaData,
    String,
    Text,
    create_engine,
)
from sqlalchemy.engine import Engine
from sqlalchemy.orm import declarative_base, sessionmaker, Session


NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}

metadata = MetaData(naming_convention=NAMING_CONVENTION)
Base = declarative_base(metadata=metadata)


class QualifiedLead(Base):
    __tablename__ = "qualified_leads"

    id = Column(Integer, primary_key=True, autoincrement=True)
    business_name = Column(String(255), nullable=False)
    address = Column(Text, nullable=True)
    phone = Column(String(50), nullable=True)
    email = Column(String(255), nullable=True)
    area = Column(String(100), nullable=False)
    city = Column(String(100), nullable=False)
    reviews_count = Column(Integer, nullable=True)
    rating = Column(Float, nullable=True)
    website = Column(Text, nullable=True)
    date_scraped = Column(DateTime, default=datetime.utcnow, nullable=False)
    status = Column(String(50), default="qualified", nullable=False)


class CityArea(Base):
    __tablename__ = "city_areas"

    id = Column(Integer, primary_key=True, autoincrement=True)
    city = Column(String(100), nullable=False)
    area = Column(String(100), nullable=False)
    status = Column(String(50), default="pending", nullable=False)  # pending|in_progress|completed|failed
    last_run_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


def make_engine(mysql_cfg: dict) -> Engine:
    user = mysql_cfg["user"]
    pwd = mysql_cfg["password"]
    host = mysql_cfg.get("host", "127.0.0.1")
    port = int(mysql_cfg.get("port", 3306))
    db = mysql_cfg["database"]
    url = f"mysql+pymysql://{user}:{pwd}@{host}:{port}/{db}?charset=utf8mb4"
    engine = create_engine(url, pool_pre_ping=True, pool_recycle=3600, future=True)
    return engine


def init_db(engine: Engine) -> None:
    Base.metadata.create_all(engine)


def make_session(engine: Engine) -> Session:
    return sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)()
