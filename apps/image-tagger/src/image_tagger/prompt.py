from __future__ import annotations

import json

from .taxonomy import Taxonomy


SYSTEM_RULES = """你是项目图库标注员。只根据画面打标。
产品品牌与产品名已由用户选定，禁止输出品牌、产品名，也不要猜测。
封闭维度必须从给定枚举的 id 里选；看不清用对应的 unknown/other/none（若有）。
先在心里完成四要素观察（产品/人物/文字/场景），再给出 tags。
标签由「主信息」决定，不是「图里出现过什么元素」。
只有手不算完整人物。包装上印刷的字可进 ocr_text，不要当成后期花字创意。
不要填写功效断言、成分断言、价格结论；ocr_text 只抄可见文字。
置信度低时把 confidence 设为 low。
只输出一个 JSON 对象，不要 Markdown。"""


def build_user_prompt(
    taxonomy: Taxonomy,
    *,
    product_id: str,
    product_name: str,
    knowledge_id: str = "",
) -> str:
    dims_block = []
    for d in taxonomy.dimensions:
        enums = ", ".join(f'{e.id}("{e.label}")' for e in d.enums)
        req = "必填" if d.required else "可空"
        dims_block.append(f"- {d.id}（{d.name}，{req}）: {enums}")

    open_block = []
    for f in taxonomy.open_fields:
        open_block.append(f"- {f.id}（{f.name}）: {f.description}；最多 {f.max_items} 项")

    schema = {
        "observations": {
            "product": "短句",
            "person": "短句",
            "text": "短句",
            "scene": "短句",
        },
        **{d.id: "enum_id_or_null" for d in taxonomy.dimensions},
        "scene_tags": ["string"],
        "ocr_text": ["string"],
    }

    return f"""已选产品（不要改、不要猜别的产品）：
- product_id: {product_id}
- product_name: {product_name}
- knowledge_id: {knowledge_id or "(无)"}

封闭维度与枚举 id：
{chr(10).join(dims_block)}

开放字段：
{chr(10).join(open_block)}

输出 JSON schema 形状：
{json.dumps(schema, ensure_ascii=False, indent=2)}
"""


def build_messages(
    taxonomy: Taxonomy,
    *,
    product_id: str,
    product_name: str,
    knowledge_id: str = "",
) -> list[dict[str, str]]:
    return [
        {"role": "system", "content": SYSTEM_RULES},
        {
            "role": "user",
            "content": build_user_prompt(
                taxonomy,
                product_id=product_id,
                product_name=product_name,
                knowledge_id=knowledge_id,
            ),
        },
    ]
