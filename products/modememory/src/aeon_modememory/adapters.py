"""Adapters for PLC mode, product, and recipe identifiers."""

from __future__ import annotations

from numbers import Integral
from typing import Any


class ModeKey:
    """Build a stable, hashable key from named PLC tag values."""

    @staticmethod
    def from_fields(**fields: Any) -> tuple:
        """Return sorted ``(field_name, value)`` pairs, omitting ``None`` values."""
        key = []
        for name, value in fields.items():
            if not isinstance(name, str) or not name.strip():
                raise ValueError("field names must be non-empty strings")
            if value is None:
                continue
            if isinstance(value, bool) or not isinstance(value, (str, Integral)):
                raise ValueError(  # noqa: TRY004
                    f"{name} must be a non-empty string or integer"
                )
            if isinstance(value, str) and not value.strip():
                raise ValueError(f"{name} must be a non-empty string or integer")
            if isinstance(value, Integral):
                value = int(value)
            key.append((name, value))
        if not key:
            raise ValueError("at least one mode field must be provided")
        return tuple(sorted(key))


def packml_mode(product_id: str | int, unit_mode: str | int | None = None) -> tuple:
    """Build a mode key from PackML ``ProductID`` and ``UnitModeCurrent`` tags."""
    if product_id is None:
        raise ValueError("product_id must be a non-empty string or integer")
    return ModeKey.from_fields(ProductID=product_id, UnitModeCurrent=unit_mode)


def isa88_mode(
    recipe_id: str | int,
    unit: str | int | None = None,
    version: str | int | None = None,
) -> tuple:
    """Build a mode key from ISA-88 recipe, unit, and optional version IDs."""
    if recipe_id is None:
        raise ValueError("recipe_id must be a non-empty string or integer")
    return ModeKey.from_fields(RecipeID=recipe_id, Unit=unit, Version=version)
