from __future__ import annotations

from pathlib import Path

# src/image_tagger/paths.py → app root is parents[2]
APP_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = APP_ROOT / "data"
DEFAULT_TAXONOMY = DATA_DIR / "taxonomy.json"
DEFAULT_MAPPING = DATA_DIR / "image_type_category_map.json"
