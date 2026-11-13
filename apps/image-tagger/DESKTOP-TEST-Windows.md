# 台式机完整流程测试说明（Windows · 离线）

> 给本机 Agent / 测试同学逐步执行。  
> 前提：本机已能跑 Ollama，且已有模型 **`xhs-tagger`**（Qwen3-VL-4B 离线导入版）。  
> 目标：跑通「词表校验 → 选产品 → 批量打标 → 看结果/待审表」整套流程。

---

## 0. 成功标准

全部满足才算测通：

1. `validate-config` 打印 `OK`
2. `taxonomy-list` 能列出「图片类型」等维度
3. 对 `inbox` 里至少 **3 张**真实产品图跑完 `tag`
4. 生成 `out/results.jsonl` 和 `out/review.csv`
5. JSONL 里每条有：`product`（人选的产品）、`tags.image_type`、`tags.image_type_category`、`status`
6. **没有**把品牌/产品名当成模型猜出来的标签字段写进 `tags`（产品只在 `product` 里）
7. 重跑同一命令后，`results.jsonl` **行数 ≈ 图片数**（不会翻倍堆积）

---

## 1. 你需要准备的东西

| 物品 | 说明 |
|---|---|
| 本说明 MD | 按顺序做 |
| `apps/image-tagger` 整个文件夹 | 从已合并的仓库或 U 盘拷来（见第 2 节） |
| Python 3.10+ | 离线机若没有，用官网 Windows 安装包离线安装；勾选 **Add python.exe to PATH** |
| Ollama + `xhs-tagger` | 已装好；终端执行 `ollama list` 能看到 |
| 测试图 ≥ 3 张 | jpg/png/webp；包装清晰为佳 |
| 一个真实或示例产品 ID | 例如 `PRODUCT-DEMO-001` / 名称「示例钙条」 |

建议目录（可改盘符）：

```text
D:\image-tagger-test\
  image-tagger\          ← 本程序（仓库里 apps/image-tagger）
  inbox\                 ← 放测试图
  out\                   ← 输出（程序也会自动建）
```

---

## 2. 把程序弄到台式机（无外网）

任选其一：

### 方式 A：U 盘拷文件夹（推荐）

1. 在有网的电脑打开仓库，切到含本程序的分支或已合并的 `main`
2. 只拷贝文件夹：`apps/image-tagger`
3. 粘贴到台式机，例如：`D:\image-tagger-test\image-tagger`

### 方式 B：整仓拷贝

拷整个 `agency-agents` 仓库也行，之后在 `apps\image-tagger` 里操作。

**不要依赖**从 Cursor 云端下超大 zip（容易 0 字节）。本程序体积很小，U 盘即可。

---

## 3. 确认 Ollama 模型还在

新开 **PowerShell** 或 **命令提示符**：

```powershell
ollama list
ollama show xhs-tagger
```

期望：

- 列表里有 `xhs-tagger`
- `show` 里 Capabilities 含 **vision**（能看图）

若没有模型：先按你们之前的 `OFFLINE-INSTALL-Windows.md` 用本地 GGUF `ollama create xhs-tagger`，再回来。

可选探活：

```powershell
curl http://127.0.0.1:11434/api/tags
```

---

## 4. 安装本程序（只需一次）

```powershell
cd D:\image-tagger-test\image-tagger
python --version
python -m pip install -e ".[dev]"
```

若 `python` 不可用，试 `py -3`：

```powershell
py -3 --version
py -3 -m pip install -e ".[dev]"
```

装完验证入口：

```powershell
python -m image_tagger.cli --help
```

应看到子命令：`taxonomy-list`、`mapping-list`、`validate-config`、`tag` 等。

---

## 5. 词表与映射自检（必做）

```powershell
cd D:\image-tagger-test\image-tagger
python -m image_tagger.cli validate-config
python -m image_tagger.cli taxonomy-list
python -m image_tagger.cli mapping-list
```

期望：

- `validate-config` → `OK: taxonomy and mapping are consistent`
- `taxonomy-list` 里有 `[image_type] 图片类型`，枚举是叶子（如 `scene_intro` / 场景介绍）
- `mapping-list` 里叶子能映到大类（如 `scene_intro → scene`）

**可选：维度管理小练习（证明管理功能可用）**

```powershell
python -m image_tagger.cli taxonomy-add-enum --dimension channel --enum-id demo_channel --label 测试渠道
python -m image_tagger.cli taxonomy-list
python -m image_tagger.cli taxonomy-remove-enum --dimension channel --enum-id demo_channel
python -m image_tagger.cli validate-config
```

**可选：映射管理小练习**

```powershell
python -m image_tagger.cli mapping-set --leaf scene_intro --category scene
python -m image_tagger.cli validate-config
```

---

## 6. 准备 inbox 图片

```powershell
mkdir D:\image-tagger-test\inbox
```

把至少 3 张产品图放进 `D:\image-tagger-test\inbox\`。  
文件名尽量英文/数字，例如 `p01.jpg`、`p02.png`。

---

## 7. 跑完整打标（核心）

**先选定产品**（模拟业务：上传前已选好产品，模型不猜品牌）：

```powershell
cd D:\image-tagger-test\image-tagger

python -m image_tagger.cli tag `
  --inbox D:\image-tagger-test\inbox `
  --product-id PRODUCT-DEMO-001 `
  --product-name "示例钙条" `
  --knowledge-id PRODUCT-DEMO-001 `
  --brand-project-id P-DEMO `
  --model xhs-tagger `
  --host http://127.0.0.1:11434 `
  --out-jsonl D:\image-tagger-test\out\results.jsonl `
  --out-review-csv D:\image-tagger-test\out\review.csv
```

说明：

- 一张图可能要几十秒到几分钟（8GB 显卡 + 4B）
- 终端会打印每张图的 `confirmed_candidate` 或 `needs_review`
- 另开窗口可看 GPU：`nvidia-smi`

---

## 8. 检查输出

### 8.1 打开待审表

用 Excel / WPS 打开：

`D:\image-tagger-test\out\review.csv`

看列：`image`、`status`、`image_type`、`image_type_category`、`tonality_primary`、`cover_fit`、`confidence`、`errors`。

### 8.2 抽查 JSONL

```powershell
Get-Content D:\image-tagger-test\out\results.jsonl -TotalCount 1
```

或用记事本打开第一行，确认大致有：

- `product.product_id` / `product.product_name` = 你在命令里写的
- `tags.image_type`、`tags.tonality_primary`、`tags.cover_fit`…
- `tags.image_type_category`（程序查映射表填的，不是模型自由发挥）
- `status`：`confirmed_candidate` 或 `needs_review`
- `validation.errors`（若有）

### 8.3 人工验收关注点

| 检查 | 期望 |
|---|---|
| 产品是不是人选的 | 是；模型没改成别的品牌名当正式产品字段 |
| 图片类型 | 是词表叶子 id；说得通 |
| 大类 | 与映射一致（如场景介绍 → scene） |
| 低置信度 / 非法枚举 | `needs_review`，并在 `errors` 有原因 |
| 只有手的图 | `person_visibility` 倾向 `hand_only`，不要当成完整人物 |

---

## 9. 重跑防重复（必测）

用**同一条**第 7 节命令再跑一遍，然后：

```powershell
(Get-Content D:\image-tagger-test\out\results.jsonl | Measure-Object -Line).Lines
```

行数应约等于 inbox 图片数，**不应变成 2 倍**。

---

## 10. 单元测试（可选，不依赖显卡出图）

不调用真实模型，只验证词表/校验逻辑：

```powershell
cd D:\image-tagger-test\image-tagger
python -m pytest -q
```

期望：全部 passed。

---

## 11. 回传给需求方的内容

请打包或粘贴：

```text
1. ollama list / ollama show xhs-tagger 摘要（是否含 vision）
2. validate-config 完整输出
3. 测试用了几张图、文件名
4. 命令里的 product-id / product-name
5. out/review.csv
6. out/results.jsonl（可只给 1～2 条样例 + 总行数）
7. 异常现象（卡死、显存爆、全是 needs_review 等）
```

---

## 12. 常见问题

| 现象 | 处理 |
|---|---|
| `ollama unreachable` | 先开 Ollama；浏览器或 curl 访问 `http://127.0.0.1:11434` |
| `model not found` | `ollama list`；模型名必须与 `--model` 一致（默认 `xhs-tagger`） |
| 很慢 / 卡死 | 关其它占 GPU 程序；图先缩到长边 ≤ 1280；确认用的是 4B 的 `xhs-tagger` |
| 几乎全是 `needs_review` | 打开 `errors`；常见是枚举写了中文 label 却校验要 id——把样例 JSON 发回即可继续改 prompt |
| `validate-config` 失败 | 不要手改坏 mapping；用 `mapping-set` 或恢复 `data/*.json` |
| 找不到 `python` | 重装 Python 并勾选 PATH，或用 `py -3` |

---

## 13. 给执行 Agent 的勾选清单

- [ ] `ollama show xhs-tagger` 含 vision  
- [ ] 已拷贝 `image-tagger` 并 `pip install -e ".[dev]"`  
- [ ] `validate-config` = OK  
- [ ] `inbox` ≥ 3 张图  
- [ ] `tag` 跑完，生成 jsonl + csv  
- [ ] 抽查产品字段正确、类型为叶子枚举  
- [ ] 重跑不导致 jsonl 行数翻倍  
- [ ] 按第 11 节回传结果  

---

## 14. 本测试明确不做

- 不配网页后台  
- 不跑文章配图推荐  
- 不要求外网、不执行 `ollama pull`  
- 不让模型重新选择品牌/产品
