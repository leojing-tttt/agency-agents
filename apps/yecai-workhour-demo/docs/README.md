# 业财 Demo · 产品需求文档索引

> 供程序员与 AI 阅读。文件为纯 Markdown，可在线预览、下载后交给 AI 分析。  
> Demo 路径：`apps/yecai-workhour-demo/` · 本地：`http://localhost:5179/`

| 文档 | 说明 | 直达 URL（本地 serve） |
|------|------|------------------------|
| [prd-workhour-manpower.md](./prd-workhour-manpower.md) | 工时填报、项目/品牌品线人力（含周状态条） | `/docs/prd-workhour-manpower.md` |
| [prd-observatory.md](./prd-observatory.md) | 观测台（CEO/CFO 高管财务） | `/docs/prd-observatory.md` |
| [prd-all.md](./prd-all.md) | 合集（便于一次下载给 AI） | `/docs/prd-all.md` |

## 给 AI 的用法

1. 打开 Demo 顶栏 **产品文档** → 下载合集 `prd-all.md`；或  
2. 直接 `curl http://localhost:5179/docs/prd-all.md`；或  
3. 把本目录下 `.md` 文件拖进对话。

## 实现对照

- 静态原型：本目录上级 `index.html` / `app.js` / `styles.css`
- 仓库 PR：`agency-agents` #13 · 分支 `cursor/liquid-system-product-demo-f6a3`
