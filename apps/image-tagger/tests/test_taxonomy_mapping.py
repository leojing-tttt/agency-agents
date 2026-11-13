from __future__ import annotations

from pathlib import Path

from image_tagger.mapping import (
    load_mapping,
    set_leaf_mapping,
    validate_mapping_against_taxonomy,
)
from image_tagger.paths import DEFAULT_MAPPING, DEFAULT_TAXONOMY
from image_tagger.taxonomy import add_enum, disable_enum, load_taxonomy, save_taxonomy


def test_default_taxonomy_and_mapping_consistent():
    tax = load_taxonomy(DEFAULT_TAXONOMY)
    mapping = load_mapping(DEFAULT_MAPPING)
    assert validate_mapping_against_taxonomy(tax, mapping) == []
    assert tax.dimension("image_type").resolve("场景介绍").id == "scene_intro"
    assert mapping.resolve_category("scene_intro").id == "scene"


def test_add_and_remove_enum(tmp_path: Path):
    tax = load_taxonomy(DEFAULT_TAXONOMY)
    tax = add_enum(tax, "channel", "yonghui", "永辉")
    assert tax.dimension("channel").resolve("yonghui") is not None
    out = tmp_path / "taxonomy.json"
    save_taxonomy(tax, out)
    reloaded = load_taxonomy(out)
    assert reloaded.dimension("channel").resolve("永辉").id == "yonghui"
    tax2 = disable_enum(reloaded, "channel", "yonghui")
    assert tax2.dimension("channel").resolve("yonghui") is None


def test_mapping_set_and_detect_orphan_leaf():
    tax = load_taxonomy(DEFAULT_TAXONOMY)
    mapping = load_mapping(DEFAULT_MAPPING)
    mapping = set_leaf_mapping(mapping, "scene_intro", "person")
    assert mapping.leaf_to_category["scene_intro"] == "person"
    # invent unknown leaf in mapping
    broken = set_leaf_mapping(mapping, "scene_intro", "scene")
    broken_leaves = dict(broken.leaf_to_category)
    broken_leaves["not_a_leaf"] = "scene"
    from image_tagger.mapping import CategoryMap

    broken_map = CategoryMap(
        version=broken.version,
        description=broken.description,
        categories=broken.categories,
        leaf_to_category=broken_leaves,
    )
    problems = validate_mapping_against_taxonomy(tax, broken_map)
    assert any("unknown leaf" in p for p in problems)
