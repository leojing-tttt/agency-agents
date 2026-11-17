from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class EnumValue:
    id: str
    label: str


@dataclass(frozen=True)
class Dimension:
    id: str
    name: str
    required: bool
    multi: bool
    enums: tuple[EnumValue, ...]

    def enum_ids(self) -> set[str]:
        return {e.id for e in self.enums}

    def enum_labels(self) -> set[str]:
        return {e.label for e in self.enums}

    def resolve(self, value: str | None) -> EnumValue | None:
        if value is None or value == "":
            return None
        for e in self.enums:
            if value == e.id or value == e.label:
                return e
        return None


@dataclass(frozen=True)
class OpenField:
    id: str
    name: str
    max_items: int
    description: str


@dataclass(frozen=True)
class Taxonomy:
    version: str
    description: str
    dimensions: tuple[Dimension, ...]
    open_fields: tuple[OpenField, ...]
    synonyms: dict[str, str]
    path: Path | None = None

    def dimension(self, dim_id: str) -> Dimension:
        for d in self.dimensions:
            if d.id == dim_id:
                return d
        raise KeyError(f"unknown dimension: {dim_id}")

    def to_dict(self) -> dict[str, Any]:
        return {
            "version": self.version,
            "description": self.description,
            "dimensions": [
                {
                    "id": d.id,
                    "name": d.name,
                    "required": d.required,
                    "multi": d.multi,
                    "enums": [{"id": e.id, "label": e.label} for e in d.enums],
                }
                for d in self.dimensions
            ],
            "open_fields": [
                {
                    "id": f.id,
                    "name": f.name,
                    "max_items": f.max_items,
                    "description": f.description,
                }
                for f in self.open_fields
            ],
            "synonyms": dict(self.synonyms),
        }


def load_taxonomy(path: Path) -> Taxonomy:
    raw = json.loads(path.read_text(encoding="utf-8"))
    dims = []
    for d in raw["dimensions"]:
        enums = tuple(EnumValue(id=e["id"], label=e["label"]) for e in d["enums"])
        dims.append(
            Dimension(
                id=d["id"],
                name=d["name"],
                required=bool(d.get("required", False)),
                multi=bool(d.get("multi", False)),
                enums=enums,
            )
        )
    opens = tuple(
        OpenField(
            id=f["id"],
            name=f["name"],
            max_items=int(f.get("max_items", 3)),
            description=f.get("description", ""),
        )
        for f in raw.get("open_fields", [])
    )
    return Taxonomy(
        version=str(raw.get("version", "0")),
        description=str(raw.get("description", "")),
        dimensions=tuple(dims),
        open_fields=opens,
        synonyms={str(k): str(v) for k, v in raw.get("synonyms", {}).items()},
        path=path,
    )


def save_taxonomy(taxonomy: Taxonomy, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(taxonomy.to_dict(), ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def add_enum(taxonomy: Taxonomy, dim_id: str, enum_id: str, label: str) -> Taxonomy:
    dim = taxonomy.dimension(dim_id)
    if enum_id in dim.enum_ids() or label in dim.enum_labels():
        raise ValueError(f"enum already exists on {dim_id}: {enum_id}/{label}")
    new_enums = dim.enums + (EnumValue(id=enum_id, label=label),)
    new_dim = Dimension(
        id=dim.id,
        name=dim.name,
        required=dim.required,
        multi=dim.multi,
        enums=new_enums,
    )
    dims = tuple(new_dim if d.id == dim_id else d for d in taxonomy.dimensions)
    return Taxonomy(
        version=taxonomy.version,
        description=taxonomy.description,
        dimensions=dims,
        open_fields=taxonomy.open_fields,
        synonyms=dict(taxonomy.synonyms),
        path=taxonomy.path,
    )


def disable_enum(taxonomy: Taxonomy, dim_id: str, enum_id: str) -> Taxonomy:
    """Remove an enum from a dimension (hard delete for v1)."""
    dim = taxonomy.dimension(dim_id)
    if enum_id not in dim.enum_ids():
        raise KeyError(f"enum not found: {dim_id}.{enum_id}")
    if dim.required and len(dim.enums) <= 1:
        raise ValueError(f"cannot remove last enum from required dimension {dim_id}")
    new_enums = tuple(e for e in dim.enums if e.id != enum_id)
    new_dim = Dimension(
        id=dim.id,
        name=dim.name,
        required=dim.required,
        multi=dim.multi,
        enums=new_enums,
    )
    dims = tuple(new_dim if d.id == dim_id else d for d in taxonomy.dimensions)
    return Taxonomy(
        version=taxonomy.version,
        description=taxonomy.description,
        dimensions=dims,
        open_fields=taxonomy.open_fields,
        synonyms=dict(taxonomy.synonyms),
        path=taxonomy.path,
    )
