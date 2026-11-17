from __future__ import annotations

from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .mapping import (
    load_mapping,
    save_mapping,
    set_leaf_mapping,
    validate_mapping_against_taxonomy,
)
from .paths import APP_ROOT, DEFAULT_MAPPING, DEFAULT_TAXONOMY
from .taxonomy import add_enum, disable_enum, load_taxonomy, save_taxonomy

WEB_DIR = APP_ROOT / "web"


class EnumIn(BaseModel):
    enum_id: str = Field(min_length=1)
    label: str = Field(min_length=1)


class MappingIn(BaseModel):
    leaf: str = Field(min_length=1)
    category: str = Field(min_length=1)


def create_app(
    taxonomy_path: Path | None = None,
    mapping_path: Path | None = None,
) -> FastAPI:
    tax_path = taxonomy_path or DEFAULT_TAXONOMY
    map_path = mapping_path or DEFAULT_MAPPING

    app = FastAPI(title="image-tagger admin", version="0.1.0")

    @app.get("/api/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/api/taxonomy")
    def get_taxonomy() -> dict[str, Any]:
        return load_taxonomy(tax_path).to_dict()

    @app.post("/api/taxonomy/dimensions/{dimension_id}/enums")
    def api_add_enum(dimension_id: str, body: EnumIn) -> dict[str, Any]:
        tax = load_taxonomy(tax_path)
        try:
            tax = add_enum(tax, dimension_id, body.enum_id, body.label)
        except (KeyError, ValueError) as e:
            raise HTTPException(status_code=400, detail=str(e)) from e
        save_taxonomy(tax, tax_path)
        # New image_type leaves must be mapped before validate passes.
        if dimension_id == "image_type":
            mapping = load_mapping(map_path)
            if body.enum_id not in mapping.leaf_to_category:
                # default to other until user edits
                try:
                    mapping = set_leaf_mapping(mapping, body.enum_id, "other")
                    save_mapping(mapping, map_path)
                except KeyError:
                    pass
        return load_taxonomy(tax_path).to_dict()

    @app.delete("/api/taxonomy/dimensions/{dimension_id}/enums/{enum_id}")
    def api_remove_enum(dimension_id: str, enum_id: str) -> dict[str, Any]:
        tax = load_taxonomy(tax_path)
        try:
            tax = disable_enum(tax, dimension_id, enum_id)
        except (KeyError, ValueError) as e:
            raise HTTPException(status_code=400, detail=str(e)) from e
        save_taxonomy(tax, tax_path)
        if dimension_id == "image_type":
            mapping = load_mapping(map_path)
            leaves = dict(mapping.leaf_to_category)
            if enum_id in leaves:
                del leaves[enum_id]
                from .mapping import CategoryMap

                mapping = CategoryMap(
                    version=mapping.version,
                    description=mapping.description,
                    categories=mapping.categories,
                    leaf_to_category=leaves,
                    path=mapping.path,
                )
                save_mapping(mapping, map_path)
        return load_taxonomy(tax_path).to_dict()

    @app.get("/api/mapping")
    def get_mapping() -> dict[str, Any]:
        return load_mapping(map_path).to_dict()

    @app.put("/api/mapping")
    def api_set_mapping(body: MappingIn) -> dict[str, Any]:
        mapping = load_mapping(map_path)
        try:
            mapping = set_leaf_mapping(mapping, body.leaf, body.category)
        except KeyError as e:
            raise HTTPException(status_code=400, detail=str(e)) from e
        save_mapping(mapping, map_path)
        return load_mapping(map_path).to_dict()

    @app.get("/api/validate")
    def api_validate() -> dict[str, Any]:
        tax = load_taxonomy(tax_path)
        mapping = load_mapping(map_path)
        problems = validate_mapping_against_taxonomy(tax, mapping)
        return {"ok": not problems, "problems": problems}

    @app.get("/")
    def index() -> FileResponse:
        return FileResponse(WEB_DIR / "index.html")

    if WEB_DIR.is_dir():
        app.mount("/static", StaticFiles(directory=WEB_DIR), name="static")

    return app


app = create_app()
