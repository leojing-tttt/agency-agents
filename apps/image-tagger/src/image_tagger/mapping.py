from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .taxonomy import Taxonomy


@dataclass(frozen=True)
class Category:
    id: str
    label: str


@dataclass(frozen=True)
class CategoryMap:
    version: str
    description: str
    categories: tuple[Category, ...]
    leaf_to_category: dict[str, str]
    path: Path | None = None

    def category_ids(self) -> set[str]:
        return {c.id for c in self.categories}

    def resolve_category(self, leaf_id: str) -> Category | None:
        cat_id = self.leaf_to_category.get(leaf_id)
        if not cat_id:
            return None
        for c in self.categories:
            if c.id == cat_id:
                return c
        return None

    def to_dict(self) -> dict[str, Any]:
        return {
            "version": self.version,
            "description": self.description,
            "categories": [{"id": c.id, "label": c.label} for c in self.categories],
            "leaf_to_category": dict(self.leaf_to_category),
        }


def load_mapping(path: Path) -> CategoryMap:
    raw = json.loads(path.read_text(encoding="utf-8"))
    cats = tuple(Category(id=c["id"], label=c["label"]) for c in raw["categories"])
    return CategoryMap(
        version=str(raw.get("version", "0")),
        description=str(raw.get("description", "")),
        categories=cats,
        leaf_to_category={str(k): str(v) for k, v in raw.get("leaf_to_category", {}).items()},
        path=path,
    )


def save_mapping(mapping: CategoryMap, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(mapping.to_dict(), ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def set_leaf_mapping(mapping: CategoryMap, leaf_id: str, category_id: str) -> CategoryMap:
    if category_id not in mapping.category_ids():
        raise KeyError(f"unknown category: {category_id}")
    leaves = dict(mapping.leaf_to_category)
    leaves[leaf_id] = category_id
    return CategoryMap(
        version=mapping.version,
        description=mapping.description,
        categories=mapping.categories,
        leaf_to_category=leaves,
        path=mapping.path,
    )


def validate_mapping_against_taxonomy(
    taxonomy: Taxonomy, mapping: CategoryMap
) -> list[str]:
    """Return human-readable problems. Empty list means OK."""
    problems: list[str] = []
    image_type = taxonomy.dimension("image_type")
    leaf_ids = image_type.enum_ids()
    cat_ids = mapping.category_ids()

    for leaf in sorted(leaf_ids):
        if leaf not in mapping.leaf_to_category:
            problems.append(f"missing mapping for image_type leaf: {leaf}")
            continue
        cat = mapping.leaf_to_category[leaf]
        if cat not in cat_ids:
            problems.append(f"leaf {leaf} maps to unknown category: {cat}")

    for leaf, cat in sorted(mapping.leaf_to_category.items()):
        if leaf not in leaf_ids:
            problems.append(f"mapping has unknown leaf not in taxonomy: {leaf}")
        if cat not in cat_ids:
            problems.append(f"mapping leaf {leaf} points to unknown category: {cat}")

    return problems
