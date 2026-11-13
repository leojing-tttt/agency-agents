from __future__ import annotations

import argparse
import csv
import json
import sys
from pathlib import Path

from .mapping import (
    load_mapping,
    save_mapping,
    set_leaf_mapping,
    validate_mapping_against_taxonomy,
)
from .paths import DEFAULT_MAPPING, DEFAULT_TAXONOMY
from .tagger import ProductContext, append_jsonl, tag_one_image
from .taxonomy import add_enum, disable_enum, load_taxonomy, save_taxonomy


IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}


def cmd_taxonomy_list(args: argparse.Namespace) -> int:
    tax = load_taxonomy(Path(args.taxonomy))
    print(f"taxonomy version={tax.version}")
    for d in tax.dimensions:
        print(f"\n[{d.id}] {d.name} required={d.required}")
        for e in d.enums:
            print(f"  - {e.id}\t{e.label}")
    return 0


def cmd_taxonomy_add_enum(args: argparse.Namespace) -> int:
    path = Path(args.taxonomy)
    tax = load_taxonomy(path)
    tax = add_enum(tax, args.dimension, args.enum_id, args.label)
    save_taxonomy(tax, path)
    print(f"added {args.dimension}.{args.enum_id}")
    return 0


def cmd_taxonomy_remove_enum(args: argparse.Namespace) -> int:
    path = Path(args.taxonomy)
    tax = load_taxonomy(path)
    tax = disable_enum(tax, args.dimension, args.enum_id)
    save_taxonomy(tax, path)
    print(f"removed {args.dimension}.{args.enum_id}")
    return 0


def cmd_mapping_list(args: argparse.Namespace) -> int:
    mapping = load_mapping(Path(args.mapping))
    print(f"mapping version={mapping.version}")
    print("categories:")
    for c in mapping.categories:
        print(f"  - {c.id}\t{c.label}")
    print("leaf_to_category:")
    for leaf, cat in sorted(mapping.leaf_to_category.items()):
        print(f"  - {leaf} → {cat}")
    return 0


def cmd_mapping_set(args: argparse.Namespace) -> int:
    path = Path(args.mapping)
    mapping = load_mapping(path)
    mapping = set_leaf_mapping(mapping, args.leaf, args.category)
    save_mapping(mapping, path)
    print(f"set {args.leaf} → {args.category}")
    return 0


def cmd_validate_config(args: argparse.Namespace) -> int:
    tax = load_taxonomy(Path(args.taxonomy))
    mapping = load_mapping(Path(args.mapping))
    problems = validate_mapping_against_taxonomy(tax, mapping)
    if problems:
        print("INVALID")
        for p in problems:
            print(f"- {p}")
        return 1
    print("OK: taxonomy and mapping are consistent")
    return 0


def cmd_tag(args: argparse.Namespace) -> int:
    tax = load_taxonomy(Path(args.taxonomy))
    mapping = load_mapping(Path(args.mapping))
    problems = validate_mapping_against_taxonomy(tax, mapping)
    if problems:
        print("config invalid; run: image-tagger validate-config", file=sys.stderr)
        for p in problems:
            print(f"- {p}", file=sys.stderr)
        return 2

    product = ProductContext(
        product_id=args.product_id,
        product_name=args.product_name,
        knowledge_id=args.knowledge_id or "",
        brand_project_id=args.brand_project_id or "",
    )

    inbox = Path(args.inbox)
    images = sorted(
        p for p in inbox.rglob("*") if p.is_file() and p.suffix.lower() in IMAGE_EXTS
    )
    if not images:
        print(f"no images in {inbox}", file=sys.stderr)
        return 1

    out_jsonl = Path(args.out_jsonl)
    out_review = Path(args.out_review_csv)
    out_jsonl.parent.mkdir(parents=True, exist_ok=True)
    out_review.parent.mkdir(parents=True, exist_ok=True)
    # Each tag run overwrites outputs so reruns do not duplicate JSONL rows.
    out_jsonl.write_text("", encoding="utf-8")

    review_rows: list[dict[str, str]] = []
    for img in images:
        print(f"tagging {img} ...")
        record = tag_one_image(
            img,
            product=product,
            taxonomy=tax,
            mapping=mapping,
            model=args.model,
            host=args.host,
        )
        append_jsonl(out_jsonl, record)
        review_rows.append(
            {
                "image": record.image_path,
                "status": record.status,
                "image_type": str(record.tags.get("image_type") or ""),
                "image_type_category": str(record.tags.get("image_type_category") or ""),
                "tonality_primary": str(record.tags.get("tonality_primary") or ""),
                "cover_fit": str(record.tags.get("cover_fit") or ""),
                "confidence": str(record.tags.get("confidence") or ""),
                "errors": "; ".join(record.validation.get("errors") or []),
            }
        )
        print(f"  → {record.status}")

    with out_review.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=[
                "image",
                "status",
                "image_type",
                "image_type_category",
                "tonality_primary",
                "cover_fit",
                "confidence",
                "errors",
            ],
        )
        writer.writeheader()
        writer.writerows(review_rows)

    print(f"wrote {out_jsonl}")
    print(f"wrote {out_review}")
    return 0


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="image-tagger", description="项目图库打标与词表管理")
    p.set_defaults(func=None)
    sub = p.add_subparsers(dest="command")

    tlist = sub.add_parser("taxonomy-list", help="列出维度与枚举")
    tlist.add_argument("--taxonomy", default=str(DEFAULT_TAXONOMY))
    tlist.set_defaults(func=cmd_taxonomy_list)

    tadd = sub.add_parser("taxonomy-add-enum", help="给某维度新增枚举")
    tadd.add_argument("--taxonomy", default=str(DEFAULT_TAXONOMY))
    tadd.add_argument("--dimension", required=True)
    tadd.add_argument("--enum-id", required=True)
    tadd.add_argument("--label", required=True)
    tadd.set_defaults(func=cmd_taxonomy_add_enum)

    trem = sub.add_parser("taxonomy-remove-enum", help="删除某维度枚举")
    trem.add_argument("--taxonomy", default=str(DEFAULT_TAXONOMY))
    trem.add_argument("--dimension", required=True)
    trem.add_argument("--enum-id", required=True)
    trem.set_defaults(func=cmd_taxonomy_remove_enum)

    mlist = sub.add_parser("mapping-list", help="列出大类与叶子映射")
    mlist.add_argument("--mapping", default=str(DEFAULT_MAPPING))
    mlist.set_defaults(func=cmd_mapping_list)

    mset = sub.add_parser("mapping-set", help="设置叶子→大类映射")
    mset.add_argument("--mapping", default=str(DEFAULT_MAPPING))
    mset.add_argument("--leaf", required=True)
    mset.add_argument("--category", required=True)
    mset.set_defaults(func=cmd_mapping_set)

    val = sub.add_parser("validate-config", help="校验词表与映射一致性")
    val.add_argument("--taxonomy", default=str(DEFAULT_TAXONOMY))
    val.add_argument("--mapping", default=str(DEFAULT_MAPPING))
    val.set_defaults(func=cmd_validate_config)

    tag = sub.add_parser("tag", help="批量打标（产品可选；未传则用占位产品）")
    tag.add_argument("--inbox", required=True, help="图片文件夹")
    tag.add_argument("--product-id", default="PRODUCT-UNSPECIFIED")
    tag.add_argument("--product-name", default="未指定产品")
    tag.add_argument("--knowledge-id", default="")
    tag.add_argument("--brand-project-id", default="")
    tag.add_argument("--taxonomy", default=str(DEFAULT_TAXONOMY))
    tag.add_argument("--mapping", default=str(DEFAULT_MAPPING))
    tag.add_argument("--model", default="xhs-tagger")
    tag.add_argument("--host", default="http://127.0.0.1:11434")
    tag.add_argument("--out-jsonl", default="out/results.jsonl")
    tag.add_argument("--out-review-csv", default="out/review.csv")
    tag.set_defaults(func=cmd_tag)

    serve = sub.add_parser("serve", help="启动标签管理前后端（浏览器打开）")
    serve.add_argument("--host", default="127.0.0.1")
    serve.add_argument("--port", type=int, default=8787)
    serve.add_argument("--taxonomy", default=str(DEFAULT_TAXONOMY))
    serve.add_argument("--mapping", default=str(DEFAULT_MAPPING))
    serve.set_defaults(func=cmd_serve)

    return p


def cmd_serve(args: argparse.Namespace) -> int:
    try:
        import uvicorn
    except ImportError:
        print(
            "缺少依赖。请执行: python -m pip install -e \".[ui]\"",
            file=sys.stderr,
        )
        return 1
    from .server import create_app

    app = create_app(Path(args.taxonomy), Path(args.mapping))
    print(f"标签管理 UI: http://{args.host}:{args.port}/")
    uvicorn.run(app, host=args.host, port=args.port, log_level="info")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    if not args.func:
        parser.print_help()
        return 2
    return int(args.func(args))


if __name__ == "__main__":
    raise SystemExit(main())
