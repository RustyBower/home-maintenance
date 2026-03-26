from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ChecklistTemplate(Base):
    __tablename__ = "checklist_templates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    items: Mapped[str] = mapped_column(
        Text, nullable=False, server_default="[]"
    )  # JSON array of {name, description, order}
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    instances: Mapped[list["ChecklistInstance"]] = relationship(
        back_populates="template",
        cascade="all, delete-orphan",
    )


class ChecklistInstance(Base):
    __tablename__ = "checklist_instances"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    template_id: Mapped[int] = mapped_column(
        ForeignKey("checklist_templates.id", ondelete="SET NULL"), nullable=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    items_state: Mapped[str] = mapped_column(
        Text, nullable=False, server_default="[]"
    )  # JSON array of {name, description, order, checked, checked_at}
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    template: Mapped["ChecklistTemplate | None"] = relationship(
        back_populates="instances"
    )
