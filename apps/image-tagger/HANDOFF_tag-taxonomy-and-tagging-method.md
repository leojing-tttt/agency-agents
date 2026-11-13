# 项目图库打标 · 现行标签定义与打标方法（完整说明）

> 文件名（英文便于跨系统拷贝）：`HANDOFF_tag-taxonomy-and-tagging-method.md`

> **读者**：原先《配图推荐 IT 交付包》作者侧的 Agent / 业务同学  
> **目的**：说明我们在落地实现后，**标签怎么定义、打标怎么做**；与你们 v1/v2 文档的对照关系；便于对齐，而不是另起一套语义。  
> **机器可读源**：`apps/image-tagger/data/taxonomy.json`（词表 v1.0.0）、`apps/image-tagger/data/image_type_category_map.json`（映射 v1.0.0）  
> **实现包**：`apps/image-tagger/`（本地 CLI 打标 + FastAPI/静态页词表管理）  
> **视觉模型**：本机 Ollama `xhs-tagger`（Qwen3-VL-4B-Instruct 量化，离线）；**不是**文档里的 DeepSeek V4.1 Flash  
> **日期**：2026-11-13  

---

## 0. 一句话结论

我们**吸收了你们标签字典 / 打标 Skill / v2 变更里的语义**（图片类型、调性、封面角色、渠道背书、主信息原则、先观察后打标、不从图猜内容类型），但把**数据结构统一成「两层」**：

```text
第一层：维度（标签类型）
第二层：该维度下的封闭枚举值（机器用 id，人看 label）
```

其中「图片类型」维度的枚举是**叶子**（有子类型的用原子类型；无子类型的主类型自身就是叶子）。  
你们原来的「主类型」不再作为标注员填写的中间层，而变成**只读大类映射**（`image_type_category`），由程序查表得出，**模型与标注员都不填第三层**。

产品品牌 / 产品名 / `knowledge_id`：**不由看图模型猜测**；由上传前选择或调用方写入（当前实现允许占位产品做联调）。

---

## 1. 相对你们原文档：保留 / 改动 / 不做

### 1.1 明确保留（语义对齐）

| 来源 | 保留内容 |
|---|---|
| `01_标签字典` / `03_图片打标Skill` / v2 | 图片类型体系（实拍、特点单点/合集、需求、场景、人物、多品、成分、实验、原理、使用、打卡、对比、价格、背书、品牌图谱、口碑、清单、其他） |
| v2 | **封面不是主类型**；用 `cover_fit` + `cover_hook` |
| Skill | 先四要素观察，再出标签；主信息原则；手 ≠ 完整人物；包装印刷字可 OCR，不等于后期花字 |
| 字典 | 调性 11 类；场景分类；渠道；背书类型 |
| 总纲 / Skill | **不从图硬判内容类型**；内容类型留给文章/批次 |
| 治理 | 低置信度不自动当「可入库」；转人工 |

### 1.2 明确改动（结构）

| 你们原来 | 我们现在 |
|---|---|
| 图片类型 = 主类型 + 可选子类型（两级嵌套在「图片类型」里） | **一个维度 `image_type`，枚举 = 全部叶子**；主类型只在映射表里当大类 |
| 产品身份常由模型「读得到才写」 | **产品身份调用方写入**；模型禁止输出品牌/品名 |
| 指定 DeepSeek V4.1 Flash | 本机 **Qwen3-VL-4B**（`xhs-tagger`） |
| Skill 文档驱动人工/他处工程 | 落地为 `taxonomy.json` + 校验代码 + 单次视觉调用 |
| 配图推荐（每图位 2 张等）同包 | **本切片不做推荐**；只做「录入打标」与词表管理 |

### 1.3 本切片明确不做

- 文章写完后的配图推荐、项目规则、保底/智能双候选  
- 从图猜测 17 类内容类型、人设最终归属  
- 质量分 / 禁用状态  
- 功效/成分/价格的**结论性标签**（OCR 可抄字，不升格为断言）  
- 小红书话题自由发挥当正式标签  
- 把每个旧「主类型」都铺成与「调性」平级的独立维度（否决；见第 2 节）

---

## 2. 标签枚举的定义方式（规范）

### 2.1 统一形状

所有**封闭标签**必须是：

```text
dimension_id  →  enum_id（稳定机器键）
              →  label（中文展示名）
```

约束：

1. 同一维度内 `enum_id` 唯一、`label` 唯一。  
2. 模型输出与入库校验一律优先认 **`enum_id`**；`label` 仅兼容解析。  
3. 维度有 `required` / `multi`：当前实现里封闭维度均为 **单选**（`multi=false`）。  
4. 词表变更走版本号 `taxonomy.version`；映射单独 `mapping.version`。

### 2.2 为什么图片类型用「叶子枚举」而不是「每主类型一个维度」

曾讨论过：把旧主类型全部升到「一级维度」，子类型当该维度枚举。  
**未采用**，因为：

- 一张图通常只有一个主信息 → 18 个类型维度会长期稀疏，校验与表头难看；  
- 无子类型的主类型（如产品实拍）没有自然枚举，形状不统一；  
- 推荐/筛图仍要问「这张图是什么类型」→ 更适合**一个字段**。

**采用**：

- 标注字段：`image_type` = 叶子 id  
- 派生字段：`image_type_category` = 映射表大类（程序填）

### 2.3 开放字段（不是枚举）

| 字段 id | 名称 | 规则 |
|---|---|---|
| `scene_tags` | 场景标签 | 开放短词，最多 **3**；同义词归并见下 |
| `ocr_text` | 画面文字 | 只抄可见文字，最多 **12** 条；不做功效/成分断言 |

同义词（程序归并，可配置）：

| 原文 | 归并为 |
|---|---|
| 爬山 | 登山 |
| 办公室 | 工位 |

### 2.4 调用方写入、不进「看图枚举」的字段

| 字段 | 说明 |
|---|---|
| `product_id` | 产品 ID |
| `product_name` | 标准产品名 |
| `knowledge_id` | 产品知识 ID（可空） |
| `brand_project_id` | 项目/品牌项目 ID（可空） |

模型若仍输出 `brand` / `product_name` 等：校验层**忽略并记错**，不写入正式 `tags`。

---

## 3. 全量维度与枚举（穷尽表）

> 下列与 `taxonomy.json` v1.0.0 **一一对应**。改词表以 JSON 为准；本文用于对齐语义。

### 3.1 `image_type` · 图片类型（必填 · 单选）

叶子枚举（标注员 / 模型只选这一层）：

| enum_id | label（中文） | 对应原主类型（大类） | 原结构说明 |
|---|---|---|---|
| `product_shot` | 产品实拍 | 产品实拍 | 无子类型，主类型即叶子 |
| `feature_single` | 产品特点-单点 | 产品特点 | 原主类型「产品特点-单点」 |
| `feature_collection` | 产品特点-合集 | 产品特点 | 原主类型「产品特点-合集」 |
| `need_pure` | 纯需求 | 需求型 | 原子类型 |
| `need_with_answer` | 需求+答案 | 需求型 | 原子类型 |
| `scene_intro` | 场景介绍 | 场景 | 原子类型 |
| `scene_need` | 场景需求 | 场景 | 原子类型 |
| `scene_use` | 场景使用 | 场景 | 原子类型 |
| `person_persona` | 人设表达 | 人物 | 原子类型 |
| `person_need` | 人物需求 | 人物 | 原子类型 |
| `person_state` | 人物状态 | 人物 | 原子类型 |
| `multi_collection` | 多品合集 | 多品图 | 原子类型 |
| `multi_compare` | 多品对比 | 多品图 | 原子类型 |
| `multi_combo` | 多品搭配 | 多品图 | 原子类型 |
| `multi_native` | 多品原生 | 多品图 | 原子类型 |
| `ingredient_highlight` | 成分圈选 | 成分 | 原子类型 |
| `ingredient_list` | 核心成分列表 | 成分 | 原子类型 |
| `ingredient_raw` | 原料特写 | 成分 | 原子类型 |
| `experiment_method` | 实验方法 | 实验 | 原子类型 |
| `experiment_result` | 实验结果 | 实验 | 原子类型 |
| `experiment_compare` | 实验对比 | 实验 | 原子类型 |
| `principle` | 原理/示意 | 原理/示意 | 无子类型 |
| `usage_steps` | 使用步骤 | 使用过程 | 原子类型 |
| `usage_method` | 使用方法 | 使用过程 | 原子类型 |
| `checkin_record` | 打卡记录 | 打卡/记录 | 原子类型 |
| `usage_record` | 使用记录 | 打卡/记录 | 原子类型 |
| `empty_bottle` | 空瓶复购 | 打卡/记录 | 原子类型 |
| `before_after` | 使用前后 | 单品对比 | 原子类型 |
| `version_compare` | 版本前后 | 单品对比 | 原子类型 |
| `price_mechanism` | 价格/机制 | 价格/机制 | 无子类型 |
| `endorse_cert` | 证书检测 | 证书/背书 | 原子类型 |
| `endorse_award` | 奖项榜单 | 证书/背书 | 原子类型 |
| `endorse_expert` | 专家机构媒体 | 证书/背书 | 原子类型 |
| `endorse_celebrity` | 明星达人 | 证书/背书 | 原子类型 |
| `endorse_supply` | 品牌供应链 | 证书/背书 | 原子类型 |
| `brand_map` | 品牌图谱 | 品牌图谱 | 合并原「品牌金字塔/分布/清单对比」为叶子级简化；大类仍为品牌图谱 |
| `review_platform` | 平台评价 | 口碑/评论截图 | 原子类型 |
| `review_chat` | 群聊记录 | 口碑/评论截图 | 原子类型 |
| `checklist` | 清单/列表 | 清单/列表 | v2 新增；无子类型 |
| `other` | 其他 | 其他 | 暂不归类 |

说明：

- **废弃**你们已废弃的 `image_type_secondary`（辅主类型）。  
- **不使用**「封面」作为 `image_type` 枚举；封面能力见 `cover_fit` / `cover_hook`。  
- `brand_map`：实现上先收成单叶子；若业务要再拆「金字塔/分布/清单」，可在维度管理中加枚举并改映射，不必改两层范式。

### 3.2 `tonality_primary` · 调性主（必填 · 单选）

| enum_id | label |
|---|---|
| `promo` | 大促型 |
| `pro` | 专业型 |
| `dry` | 干货型 |
| `persona` | 人设型 |
| `creative` | 创意型 |
| `meme` | 梗图型 |
| `ai` | AI型 |
| `magazine` | 杂志型 |
| `atmosphere` | 氛围型 |
| `native` | 原生型 |
| `general` | 通用型 |

判定顺序（写入模型规则，与你们 Skill 一致，命中即停思路）：

1. 大促型 → 2. 专业型 → 3. 干货型 → 4. 人设型 → 5. 创意型 → 6. 梗图型 → 7. AI型 → 8. 杂志型 / 氛围型 → 9. 原生型 → 10. 通用型  

证据门槛仍按你们文档：专业要有证书/文献/医护实验室等；干货要有原理；杂志要有字体版式美术；大促要有机制/事件；不能「看起来干净」就标专业。

### 3.3 `tonality_secondary` · 调性辅（可空 · 单选）

枚举集合与调性主**相同**。仅当两个调性确实接近时填写；否则 `null`。

### 3.4 `cover_fit` · 封面适配（必填 · 单选）

| enum_id | label |
|---|---|
| `yes` | 是 |
| `no` | 否 |
| `unknown` | 待定 |

### 3.5 `cover_hook` · 封面钩子（可空 · 单选）

| enum_id | label |
|---|---|
| `pain` | 痛点 |
| `result` | 结果 |
| `persona` | 人设 |
| `scene` | 场景 |
| `science` | 科普 |
| `price` | 价格 |
| `list` | 清单 |

程序规则：若 `cover_fit != yes`，校验后强制将 `cover_hook` 置空。

### 3.6 `scene_category` · 场景分类（必填 · 单选）

| enum_id | label |
|---|---|
| `indoor` | 室内 |
| `outdoor` | 室外 |
| `white` | 白底 |
| `other` | 其他 |

### 3.7 `channel` · 渠道（必填 · 单选）

| enum_id | label |
|---|---|
| `mannings` | 万宁 |
| `watsons` | 屈臣氏 |
| `sam` | 山姆 |
| `costco` | Costco |
| `kids` | 孩子王 |
| `ole` | Olé |
| `pangdonglai` | 胖东来 |
| `other` | 其他 |
| `none` | 无 |
| `unknown` | 看不清 |

语义：销售/信任场景（门头/货架/价签），不是普通 `scene_tags`，也不是图片类型。

### 3.8 `backing_type` · 背书类型（必填 · 单选）

| enum_id | label |
|---|---|
| `gov_media` | 政府媒体 |
| `celebrity` | 明星达人 |
| `channel` | 渠道 |
| `evidence` | 实证 |
| `brand_rd` | 品牌历史研发 |
| `other` | 其他 |
| `none` | 无 |
| `unknown` | 看不清 |

当 `backing_type=channel` 时，具体渠道落在 `channel` 字段（两字段不合并）。

### 3.9 `person_visibility` · 人物可见（必填 · 单选）

| enum_id | label |
|---|---|
| `full` | 完整人物 |
| `hand_only` | 只有手 |
| `background` | 背景小人 |
| `none` | 无 |

硬规则：**只有手 ≠ 完整人物**；人设型调性需要完整人物为主体。

### 3.10 `person_count` · 人物数量（必填 · 单选）

| enum_id | label |
|---|---|
| `0` | 0 |
| `1` | 1 |
| `2plus` | 2+ |

### 3.11 `product_count` · 画面产品数（必填 · 单选）

| enum_id | label |
|---|---|
| `0` | 0 |
| `1` | 1 |
| `2` | 2 |
| `3plus` | 3+ |

说明：这是**画面里可见产品个数**，不是「是不是库里那个 SKU」。SKU 以调用方产品身份为准。

### 3.12 `package` · 包装形态（可空 · 单选）

| enum_id | label |
|---|---|
| `box` | 盒 |
| `bottle` | 瓶 |
| `sachet` | 条包 |
| `blister` | 泡罩 |
| `can` | 罐 |
| `tube` | 管 |
| `other` | 其他 |
| `unknown` | 看不清 |

### 3.13 `product_role` · 产品角色（必填 · 单选）

| enum_id | label |
|---|---|
| `hero` | 主角 |
| `prop` | 道具 |
| `background` | 背景 |
| `absent` | 未出现 |

### 3.14 `set_relation` · 同框关系（必填 · 单选）

| enum_id | label |
|---|---|
| `single` | 单品 |
| `same_brand_multi` | 同品牌多品 |
| `same_category_multi` | 同品类多品 |
| `cross_category` | 跨品类合集 |
| `unclear` | 不明确 |
| `none` | 无产品 |

### 3.15 `confidence` · 置信度（必填 · 单选）

| enum_id | label | 系统动作 |
|---|---|---|
| `high` | 高 | 可倾向自动通过（仍可人审） |
| `medium` | 中 | 可输出标签 |
| `low` | 低 | **强制 `needs_review`**，不视为可确认入库 |

对齐你们 Skill：低置信度不硬推入库标签。

---

## 4. 大类映射表（穷尽）

> 源：`image_type_category_map.json` v1.0.0  
> 用途：汇总、筛图、对接「图位要某主类型」时的兼容层  
> **标注员与模型不填**；打标完成后由程序写入 `image_type_category` / `image_type_category_label`

### 4.1 大类列表

| category_id | label |
|---|---|
| `product_shot` | 产品实拍 |
| `feature` | 产品特点 |
| `need` | 需求型 |
| `scene` | 场景 |
| `person` | 人物 |
| `multi` | 多品图 |
| `ingredient` | 成分 |
| `experiment` | 实验 |
| `principle` | 原理/示意 |
| `usage` | 使用过程 |
| `checkin` | 打卡/记录 |
| `compare` | 单品对比 |
| `price` | 价格/机制 |
| `endorse` | 证书/背书 |
| `brand_map` | 品牌图谱 |
| `review` | 口碑/评论截图 |
| `checklist` | 清单/列表 |
| `other` | 其他 |

### 4.2 叶子 → 大类（全量）

| leaf (`image_type`) | category |
|---|---|
| product_shot | product_shot |
| feature_single | feature |
| feature_collection | feature |
| need_pure | need |
| need_with_answer | need |
| scene_intro | scene |
| scene_need | scene |
| scene_use | scene |
| person_persona | person |
| person_need | person |
| person_state | person |
| multi_collection | multi |
| multi_compare | multi |
| multi_combo | multi |
| multi_native | multi |
| ingredient_highlight | ingredient |
| ingredient_list | ingredient |
| ingredient_raw | ingredient |
| experiment_method | experiment |
| experiment_result | experiment |
| experiment_compare | experiment |
| principle | principle |
| usage_steps | usage |
| usage_method | usage |
| checkin_record | checkin |
| usage_record | checkin |
| empty_bottle | checkin |
| before_after | compare |
| version_compare | compare |
| price_mechanism | price |
| endorse_cert | endorse |
| endorse_award | endorse |
| endorse_expert | endorse |
| endorse_celebrity | endorse |
| endorse_supply | endorse |
| brand_map | brand_map |
| review_platform | review |
| review_chat | review |
| checklist | checklist |
| other | other |

治理规则：每个 `image_type` 叶子必须有映射；映射不得指向不存在的大类；删叶子时同步删映射。管理 UI / CLI 均可维护。

---

## 5. 打标方法（现行实现）

### 5.1 流水线

```text
1. 调用方提供产品上下文（可占位）+ 图片路径
2. 加载 taxonomy.json + image_type_category_map.json
3. 组装「系统规则 + 全量维度枚举 id」提示词
4. 【单次】本机视觉模型调用（Ollama /api/generate，format=json，一张图）
5. 模型返回 JSON：observations + 各维度 + 开放字段
6. 程序校验：
   - 封闭字段必须是合法 enum_id（或可解析的 label）
   - 丢掉品牌/品名等禁填字段
   - confidence=low → needs_review
   - cover_fit≠yes → 清空 cover_hook
   - 查映射表附加 image_type_category
7. 写出 results.jsonl + review.csv
```

### 5.2 为什么不是「每个维度一个提示词」

| 方案 | 结论 |
|---|---|
| 每维度单独调用 | 慢、贵、维度间易矛盾 |
| **一次调用 + 词表进 prompt + 代码校验** | **现行** |
| 失败维度二次补打 | 未做，可后续加 |

这与你们 Skill「一次请求里先观察后 tags、schema 强制顺序」一致；观察在 JSON 的 `observations` 里，校验层会透传保留。

### 5.3 模型系统规则（摘要）

实现原文在 `src/image_tagger/prompt.py` 的 `SYSTEM_RULES`，要点：

1. 只根据画面打标  
2. 禁止输出/猜测品牌与产品名（产品已由调用方选定）  
3. 封闭维度只能选给定 **enum_id**  
4. 先四要素观察，再 tags  
5. **主信息**决定类型，不是元素出现即类型  
6. 只有手不算完整人物  
7. 不做功效/成分/价格断言；`ocr_text` 只抄字  
8. 低把握 → `confidence=low`  
9. 只输出一个 JSON 对象  

### 5.4 模型输出形状（逻辑 schema）

```json
{
  "observations": {
    "product": "短句",
    "person": "短句",
    "text": "短句",
    "scene": "短句"
  },
  "image_type": "enum_id",
  "tonality_primary": "enum_id",
  "tonality_secondary": "enum_id|null",
  "cover_fit": "yes|no|unknown",
  "cover_hook": "enum_id|null",
  "scene_category": "enum_id",
  "channel": "enum_id",
  "backing_type": "enum_id",
  "person_visibility": "enum_id",
  "person_count": "enum_id",
  "product_count": "enum_id",
  "package": "enum_id|null",
  "product_role": "enum_id",
  "set_relation": "enum_id",
  "confidence": "high|medium|low",
  "scene_tags": ["string"],
  "ocr_text": ["string"]
}
```

### 5.5 落库/导出记录形状（程序侧）

每条 JSONL 逻辑字段：

| 区块 | 内容 |
|---|---|
| `product` | 调用方写入的产品身份 |
| `taxonomy_version` / `mapping_version` | 词表与映射版本 |
| `model` | 如 `xhs-tagger` |
| `image_path` / `image_sha256` | 溯源与去重 |
| `raw_model` | 模型原文 |
| `validation` | `ok` / `needs_review` / `errors[]` |
| `tags` | 校验后的维度值 + `image_type_category` + `image_type_category_label` + 开放字段 + 可选 `observations` |
| `status` | `confirmed_candidate` 或 `needs_review` |

说明：`confirmed_candidate` 表示「通过机器校验、可作为候选入库」，**不等于**业务终审完成；人审流程可另接。

### 5.6 与你们「录入段 A」的对应

```text
你们：上传 → AI 预打标 → 人工检查 → 确认入库
我们：选产品(可后补) → 单次视觉预打标 → review.csv/人工 → （入库接口未做，导出先行）
```

推荐段 C（文章配图）**不在本实现范围**。

---

## 6. 词表治理与界面

### 6.1 文件

| 文件 | 职责 |
|---|---|
| `data/taxonomy.json` | 维度 + 枚举 + 开放字段 + 同义词 |
| `data/image_type_category_map.json` | 大类定义 + 叶子映射 |

### 6.2 管理能力

- CLI：`taxonomy-list` / `taxonomy-add-enum` / `taxonomy-remove-enum` / `mapping-list` / `mapping-set` / `validate-config`  
- UI：`python -m image_tagger.cli serve` → 浏览器 `http://127.0.0.1:8787/`  
  - 维度管理、映射管理、校验  

新增 `image_type` 叶子时：UI/API 会默认映射到 `other`，需业务改成正确大类后再视为治理完成。

### 6.3 打标入口

- CLI：`python -m image_tagger.cli tag --inbox ...`（`--product-id` / `--product-name` 可省略，默认占位产品）  
- 上传打标网页：**未做**

---

## 7. 边界与冲突消解（给对齐用）

下列与你们 `07_判定边界` / Skill 一致，实现侧作为规则写入 prompt；若文档与 v2 冲突，**以 v2 + 本词表为准**：

1. 标签看「主信息」，不是「出现过某元素」。  
2. 封面是角色（`cover_fit`），不是 `image_type`。  
3. 多品陈列 vs 单品对比 vs 产品特点-合集：按主信息与是否同维度比较/单产品多特点区分。  
4. 渠道与背书分字段。  
5. 内容类型、人设最终归属：打标不做最终判决。  
6. `07` 中若仍出现「封面型当主类型」的旧表述，落地以 **cover_fit** 为准。

---

## 8. 对接你们数据契约时的字段映射建议

若继续使用 `image_library` CSV 一类契约，建议：

| 你们字段 | 我们字段 |
|---|---|
| `image_type_primary` + `image_subtype` | 合并为 `image_type`（叶子 id）；大类用 `image_type_category` |
| `tonality_primary` / `tonality_secondary` | 同名，值为 enum_id |
| `cover_fit` / `cover_hook` | 同名 |
| `channel` / `backing_type` | 同名 |
| `scene_category` / `scene_tags` | 同名 |
| `product_name` / `knowledge_id` | 来自调用方 `product`，非模型 tags |
| `content_types` / `persona` | 本切片不打；可空或由上游写入 |
| `feature_id` / `feature_name` | 本切片不自动绑定；特点类图仅到 `image_type` 叶子 |

---

## 9. 请对方确认或反馈的点（可选）

1. `brand_map` 是否需要再拆成多个叶子枚举。  
2. 渠道列表是否要增删（如永辉等）——可用维度管理直接加。  
3. 推荐模块是否继续用「主类型」匹配：若是，请统一读 `image_type_category`，不要再要求模型输出主+子两级。  
4. 人审通过后的正式入库状态机，是否由你们 IT 契约定义（我们目前导出到 `needs_review` / `confirmed_candidate`）。

---

## 10. 附录：仓库内相关路径

```text
apps/image-tagger/
  data/taxonomy.json
  data/image_type_category_map.json
  src/image_tagger/prompt.py      # 系统规则与提示词
  src/image_tagger/validate.py    # 枚举校验
  src/image_tagger/tagger.py      # 单次调用编排
  src/image_tagger/server.py      # 管理 API
  web/                            # 管理前端
  DESKTOP-TEST-Windows.md         # 离线机测试说明
  HANDOFF_标签体系与打标方法_给业务文档方.md  # 本文
```

---

**文档结束。** 若需与贵方原文逐条 diff，请以 `01_标签字典.md`、`03_图片打标Skill.md`、`40_1.0图片标签体系_v2_变更说明.md` 为对照基线；本文第 1、3、4、5 节为现行权威摘要，机器权威以两个 JSON 为准。
