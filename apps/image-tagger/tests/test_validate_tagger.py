from __future__ import annotations

from pathlib import Path

from image_tagger.mapping import load_mapping
from image_tagger.paths import DEFAULT_MAPPING, DEFAULT_TAXONOMY
from image_tagger.tagger import ProductContext, tag_one_image
from image_tagger.taxonomy import load_taxonomy
from image_tagger.validate import validate_model_tags


def _valid_raw(**overrides):
    base = {
        "observations": {
            "product": "一瓶产品居中",
            "person": "无",
            "text": "包装有品名",
            "scene": "白底棚拍",
        },
        "image_type": "product_shot",
        "tonality_primary": "general",
        "tonality_secondary": None,
        "cover_fit": "no",
        "cover_hook": "pain",
        "scene_category": "white",
        "channel": "none",
        "backing_type": "none",
        "person_visibility": "none",
        "person_count": "0",
        "product_count": "1",
        "package": "bottle",
        "product_role": "hero",
        "set_relation": "single",
        "confidence": "high",
        "scene_tags": ["白底"],
        "ocr_text": ["示例字"],
        "brand": "应被忽略",
    }
    base.update(overrides)
    return base


def test_validate_accepts_closed_enums_and_strips_brand():
    tax = load_taxonomy(DEFAULT_TAXONOMY)
    mapping = load_mapping(DEFAULT_MAPPING)
    result = validate_model_tags(_valid_raw(), tax, mapping)
    assert result.ok is True
    assert result.needs_review is False
    assert result.tags["image_type"] == "product_shot"
    assert result.image_type_category == "product_shot"
    assert result.tags["cover_hook"] is None  # cleared when cover_fit != yes
    assert any("forbidden" in e for e in result.errors)


def test_validate_rejects_invalid_enum_and_low_confidence():
    tax = load_taxonomy(DEFAULT_TAXONOMY)
    mapping = load_mapping(DEFAULT_MAPPING)
    bad = validate_model_tags(_valid_raw(image_type="不是枚举"), tax, mapping)
    assert bad.ok is False
    assert bad.needs_review is True
    low = validate_model_tags(_valid_raw(confidence="low"), tax, mapping)
    assert low.ok is False
    assert low.needs_review is True


def test_ocr_text_respects_taxonomy_max_items():
    tax = load_taxonomy(DEFAULT_TAXONOMY)
    mapping = load_mapping(DEFAULT_MAPPING)
    ocr_max = next(f.max_items for f in tax.open_fields if f.id == "ocr_text")
    too_many = [f"line-{i}" for i in range(ocr_max + 5)]
    result = validate_model_tags(_valid_raw(ocr_text=too_many), tax, mapping)
    assert len(result.tags["ocr_text"]) == ocr_max


def test_tag_one_image_single_call(tmp_path: Path):
    tax = load_taxonomy(DEFAULT_TAXONOMY)
    mapping = load_mapping(DEFAULT_MAPPING)
    img = tmp_path / "a.jpg"
    img.write_bytes(b"\xff\xd8\xff\xd9")  # minimal jpeg-ish bytes

    def fake_generate(**kwargs):
        assert kwargs["image_path"] == img
        assert "product_id: P-1" in kwargs["prompt"]
        assert "示例产品" in kwargs["prompt"]
        return _valid_raw()

    record = tag_one_image(
        img,
        product=ProductContext(
            product_id="P-1",
            product_name="示例产品",
            knowledge_id="K-1",
        ),
        taxonomy=tax,
        mapping=mapping,
        generate=fake_generate,
    )
    assert record.status == "confirmed_candidate"
    assert record.product["product_id"] == "P-1"
    assert record.tags["image_type"] == "product_shot"
    assert "brand" not in record.tags
