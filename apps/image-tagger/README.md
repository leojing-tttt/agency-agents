# image-tagger · 项目图库打标

本地批处理打标：先选产品，再对图片打 **两层标签（维度 → 枚举）**。  
视觉模型用本机 Ollama（默认 `xhs-tagger`）。产品品牌/品名**不由模型猜**。

## 功能清单

### A. 维度（标签类型）管理

| 能力 | 命令 |
|---|---|
| 列出全部维度与枚举 | `image-tagger taxonomy-list` |
| 给维度新增枚举 | `image-tagger taxonomy-add-enum --dimension channel --enum-id yonghui --label 永辉` |
| 删除枚举 | `image-tagger taxonomy-remove-enum --dimension channel --enum-id yonghui` |
| 词表文件 | `data/taxonomy.json`（可手改，改完跑校验） |

维度例：`image_type`、`tonality_primary`、`cover_fit`、`scene_category`、`channel`…  
`image_type` 的枚举是**叶子**（原「子类型」；无子类的主类型本身也是叶子）。

### B. 映射表管理（叶子 → 大类）

| 能力 | 命令 |
|---|---|
| 列出大类与映射 | `image-tagger mapping-list` |
| 设置叶子映射 | `image-tagger mapping-set --leaf scene_intro --category scene` |
| 与词表交叉校验 | `image-tagger validate-config` |
| 映射文件 | `data/image_type_category_map.json` |

映射只用于汇总/筛图/推荐图位，**标注员不填第三层**。

### C. 打标

```bash
image-tagger tag \
  --inbox ./inbox \
  --product-id PRODUCT-001 \
  --product-name "示例钙条" \
  --knowledge-id PRODUCT-BAYER-XINGANBAO \
  --brand-project-id P-DEMO \
  --model xhs-tagger \
  --out-jsonl out/results.jsonl \
  --out-review-csv out/review.csv
```

- 输入：已选产品 + 图片文件夹  
- 输出：`results.jsonl`（全量）+ `review.csv`（待审清单）  
- `confidence=low` 或枚举非法 → `needs_review`

## 打标怎么调用大模型？（不是每个维度一个提示词）

**一次视觉调用，打齐所有封闭维度；程序再按词表校验。**

```text
已选产品上下文
     +
taxonomy 全部维度枚举
     +
一张图
     ↓
  单次 Ollama /api/generate（format=json）
     ↓
  模型返回 JSON（含 observations + 各维度 id）
     ↓
  validate：枚举必须在表内；禁填品牌；低置信度转人工
     ↓
  用 mapping 附上 image_type_category（大类）
```

| 方案 | 评价 |
|---|---|
| **每维度一个提示词 / 多次调用** | 慢、贵、维度之间容易互相矛盾 |
| **一次调用 + 词表塞进 prompt + 代码校验（本项目）** | 与业务 Skill「先观察后打标」一致；规矩在程序里 |
| 校验失败再对失败维度补打 | 可作后续优化，第一版不做 |

模型**看不见**映射表大类；大类由程序根据 `image_type` 叶子查表得出。

## 安装（Windows 离线机）

需要本机已装 Python 3.10+ 与 Ollama 模型 `xhs-tagger`。

```powershell
cd apps\image-tagger
python -m pip install -e ".[dev]"
image-tagger validate-config
image-tagger taxonomy-list
```

## 测试

```powershell
python -m pytest -q
```

## 明确不做（本切片）

- 网页版管理后台（先用 CLI + JSON）  
- 文章配图推荐、每图位 2 张  
- 从图猜内容类型 / 猜品牌品名  
- 自动发布小红书
