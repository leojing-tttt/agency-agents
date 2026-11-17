from __future__ import annotations

import json
from pathlib import Path

from fastapi.testclient import TestClient

from image_tagger.paths import DEFAULT_MAPPING, DEFAULT_TAXONOMY
from image_tagger.server import create_app


def _client(tmp_path: Path) -> TestClient:
    tax = DEFAULT_TAXONOMY.read_text(encoding="utf-8")
    mapping = DEFAULT_MAPPING.read_text(encoding="utf-8")
    tax_path = tmp_path / "taxonomy.json"
    map_path = tmp_path / "mapping.json"
    tax_path.write_text(tax, encoding="utf-8")
    map_path.write_text(mapping, encoding="utf-8")
    return TestClient(create_app(tax_path, map_path))


def test_api_taxonomy_mapping_validate_roundtrip(tmp_path: Path):
    client = _client(tmp_path)
    assert client.get("/api/health").json()["status"] == "ok"
    tax = client.get("/api/taxonomy").json()
    assert any(d["id"] == "image_type" for d in tax["dimensions"])
    assert client.get("/api/validate").json()["ok"] is True

    added = client.post(
        "/api/taxonomy/dimensions/channel/enums",
        json={"enum_id": "ui_test_ch", "label": "界面测试渠道"},
    )
    assert added.status_code == 200
    labels = [
        e["label"]
        for d in added.json()["dimensions"]
        if d["id"] == "channel"
        for e in d["enums"]
    ]
    assert "界面测试渠道" in labels

    removed = client.delete("/api/taxonomy/dimensions/channel/enums/ui_test_ch")
    assert removed.status_code == 200
    assert client.get("/api/validate").json()["ok"] is True


def test_index_html_served(tmp_path: Path):
    client = _client(tmp_path)
    res = client.get("/")
    assert res.status_code == 200
    assert "维度管理" in res.text
