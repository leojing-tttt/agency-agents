from __future__ import annotations

import hashlib
import json
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

from .mapping import CategoryMap
from .ollama_client import generate_vision_json
from .prompt import SYSTEM_RULES, build_user_prompt
from .taxonomy import Taxonomy
from .validate import ValidationResult, validate_model_tags


GenerateFn = Callable[..., dict[str, Any]]


@dataclass
class ProductContext:
    product_id: str
    product_name: str
    knowledge_id: str = ""
    brand_project_id: str = ""


@dataclass
class TagRecord:
    image_path: str
    image_sha256: str
    product: dict[str, str]
    taxonomy_version: str
    mapping_version: str
    model: str
    created_at: str
    raw_model: dict[str, Any]
    validation: dict[str, Any]
    tags: dict[str, Any]
    status: str  # confirmed_candidate | needs_review

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def file_sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def tag_one_image(
    image_path: Path,
    *,
    product: ProductContext,
    taxonomy: Taxonomy,
    mapping: CategoryMap,
    model: str = "xhs-tagger",
    host: str = "http://127.0.0.1:11434",
    generate: GenerateFn | None = None,
) -> TagRecord:
    """One vision call for all dimensions, then code validates against taxonomy."""
    gen = generate or generate_vision_json
    prompt = build_user_prompt(
        taxonomy,
        product_id=product.product_id,
        product_name=product.product_name,
        knowledge_id=product.knowledge_id,
    )
    raw = gen(
        host=host,
        model=model,
        prompt=prompt,
        system=SYSTEM_RULES,
        image_path=image_path,
    )
    result: ValidationResult = validate_model_tags(raw, taxonomy, mapping)
    status = "confirmed_candidate" if result.ok and not result.needs_review else "needs_review"

    tags = dict(result.tags)
    tags["image_type_category"] = result.image_type_category
    tags["image_type_category_label"] = result.image_type_category_label

    return TagRecord(
        image_path=str(image_path),
        image_sha256=file_sha256(image_path),
        product={
            "product_id": product.product_id,
            "product_name": product.product_name,
            "knowledge_id": product.knowledge_id,
            "brand_project_id": product.brand_project_id,
        },
        taxonomy_version=taxonomy.version,
        mapping_version=mapping.version,
        model=model,
        created_at=datetime.now(timezone.utc).isoformat(),
        raw_model=raw,
        validation={
            "ok": result.ok,
            "needs_review": result.needs_review,
            "errors": result.errors,
        },
        tags=tags,
        status=status,
    )


def append_jsonl(path: Path, record: TagRecord) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(record.to_dict(), ensure_ascii=False) + "\n")
