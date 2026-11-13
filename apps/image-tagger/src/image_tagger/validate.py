from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from .mapping import CategoryMap
from .taxonomy import Taxonomy


@dataclass
class ValidationResult:
    ok: bool
    tags: dict[str, Any]
    errors: list[str] = field(default_factory=list)
    needs_review: bool = False
    image_type_category: str | None = None
    image_type_category_label: str | None = None


def _normalize_scene_tags(tags: Any, synonyms: dict[str, str], max_items: int) -> list[str]:
    if tags is None:
        return []
    if isinstance(tags, str):
        raw = [tags]
    elif isinstance(tags, list):
        raw = [str(t).strip() for t in tags if str(t).strip()]
    else:
        return []
    out: list[str] = []
    for t in raw:
        t = synonyms.get(t, t)
        if t not in out:
            out.append(t)
        if len(out) >= max_items:
            break
    return out


def validate_model_tags(
    raw: dict[str, Any],
    taxonomy: Taxonomy,
    mapping: CategoryMap,
) -> ValidationResult:
    errors: list[str] = []
    tags: dict[str, Any] = {}
    needs_review = False

    # Strip forbidden product-identity guesses if model still emits them.
    for banned in ("brand", "product_name", "brand_name", "产品品牌", "产品名"):
        if banned in raw:
            errors.append(f"ignored forbidden field from model: {banned}")

    for dim in taxonomy.dimensions:
        value = raw.get(dim.id)
        if value is None or value == "" or value == "null":
            if dim.required:
                errors.append(f"missing required dimension: {dim.id}")
                needs_review = True
            tags[dim.id] = None
            continue
        resolved = dim.resolve(str(value))
        if resolved is None:
            errors.append(f"invalid enum for {dim.id}: {value!r}")
            tags[dim.id] = None
            needs_review = True
            continue
        tags[dim.id] = resolved.id

    # Open fields — caps come from taxonomy.open_fields
    open_limits = {f.id: f.max_items for f in taxonomy.open_fields}
    scene_max = open_limits.get("scene_tags", 3)
    ocr_max = open_limits.get("ocr_text", 12)
    tags["scene_tags"] = _normalize_scene_tags(
        raw.get("scene_tags"), taxonomy.synonyms, scene_max
    )

    ocr = raw.get("ocr_text") or raw.get("画面文字") or []
    if isinstance(ocr, str):
        ocr_list = [ocr] if ocr.strip() else []
    elif isinstance(ocr, list):
        ocr_list = [str(x).strip() for x in ocr if str(x).strip()]
    else:
        ocr_list = []
    tags["ocr_text"] = ocr_list[:ocr_max]

    # observations passthrough (optional)
    if "observations" in raw and isinstance(raw["observations"], dict):
        tags["observations"] = raw["observations"]

    confidence = tags.get("confidence")
    if confidence == "low":
        errors.append("low confidence → needs human review")

    image_type = tags.get("image_type")
    category = None
    category_label = None
    if image_type:
        cat = mapping.resolve_category(image_type)
        if cat is None:
            errors.append(f"no category mapping for image_type: {image_type}")
        else:
            category = cat.id
            category_label = cat.label

    # cover_hook only meaningful when cover_fit is yes
    if tags.get("cover_fit") != "yes":
        tags["cover_hook"] = None

    soft_prefixes = ("ignored forbidden",)
    hard = [e for e in errors if not e.startswith(soft_prefixes)]
    needs_review = bool(hard)
    ok = not needs_review

    return ValidationResult(
        ok=ok,
        tags=tags,
        errors=errors,
        needs_review=needs_review,
        image_type_category=category,
        image_type_category_label=category_label,
    )
