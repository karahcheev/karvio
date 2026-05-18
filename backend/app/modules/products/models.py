from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.common import generate_id, now_utc
from app.models.enums import (
    ComponentDependencyType,
    ComponentRiskLevel,
    CoverageStrength,
    CoverageType,
    ProductStatus,
)


class Product(Base):
    __tablename__ = "products"
    __table_args__ = (UniqueConstraint("project_id", "key", name="uq_products_project_key"),)

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=generate_id)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    key: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text())
    owner_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    status: Mapped[ProductStatus] = mapped_column(
        Enum(ProductStatus, name="product_status"),
        default=ProductStatus.active,
        nullable=False,
    )
    tags: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False)

    components: Mapped[list["ProductComponentLink"]] = relationship(
        back_populates="product",
        cascade="all, delete-orphan",
    )


class Component(Base):
    __tablename__ = "components"
    __table_args__ = (UniqueConstraint("project_id", "key", name="uq_components_project_key"),)

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=generate_id)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    key: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text())
    owner_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    status: Mapped[ProductStatus] = mapped_column(
        Enum(ProductStatus, name="product_status"),
        default=ProductStatus.active,
        nullable=False,
    )
    tags: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)

    business_criticality: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    change_frequency: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    integration_complexity: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    defect_density: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    production_incident_score: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    automation_confidence: Mapped[int] = mapped_column(Integer, default=5, nullable=False)
    risk_score: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    risk_level: Mapped[ComponentRiskLevel] = mapped_column(
        Enum(ComponentRiskLevel, name="component_risk_level"),
        default=ComponentRiskLevel.low,
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False)

    products: Mapped[list["ProductComponentLink"]] = relationship(
        back_populates="component",
        cascade="all, delete-orphan",
    )


class ProductComponentLink(Base):
    __tablename__ = "product_component_links"
    __table_args__ = (UniqueConstraint("product_id", "component_id", name="uq_product_component_link"),)

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=generate_id)
    product_id: Mapped[str] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    component_id: Mapped[str] = mapped_column(ForeignKey("components.id", ondelete="CASCADE"), nullable=False, index=True)
    is_core: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    product: Mapped["Product"] = relationship(back_populates="components")
    component: Mapped["Component"] = relationship(back_populates="products")


class ComponentDependency(Base):
    __tablename__ = "component_dependencies"
    __table_args__ = (
        UniqueConstraint("source_component_id", "target_component_id", name="uq_component_dependency"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=generate_id)
    source_component_id: Mapped[str] = mapped_column(
        ForeignKey("components.id", ondelete="CASCADE"), nullable=False, index=True
    )
    target_component_id: Mapped[str] = mapped_column(
        ForeignKey("components.id", ondelete="CASCADE"), nullable=False, index=True
    )
    dependency_type: Mapped[ComponentDependencyType] = mapped_column(
        Enum(ComponentDependencyType, name="component_dependency_type"),
        default=ComponentDependencyType.depends_on,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)


class TestCaseComponentCoverage(Base):
    __tablename__ = "test_case_component_coverages"
    __table_args__ = (UniqueConstraint("test_case_id", "component_id", name="uq_test_case_component_coverage"),)

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=generate_id)
    test_case_id: Mapped[str] = mapped_column(ForeignKey("test_cases.id", ondelete="CASCADE"), nullable=False, index=True)
    component_id: Mapped[str] = mapped_column(ForeignKey("components.id", ondelete="CASCADE"), nullable=False, index=True)
    coverage_type: Mapped[CoverageType] = mapped_column(
        Enum(CoverageType, name="coverage_type"),
        default=CoverageType.direct,
        nullable=False,
    )
    coverage_strength: Mapped[CoverageStrength] = mapped_column(
        Enum(CoverageStrength, name="coverage_strength"),
        default=CoverageStrength.regression,
        nullable=False,
    )
    is_mandatory_for_release: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text())
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False)

    component: Mapped["Component"] = relationship()
