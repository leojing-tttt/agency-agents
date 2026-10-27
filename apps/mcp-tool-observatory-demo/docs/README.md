# MCP 工具观测台 · 产品需求文档索引

> 供程序员与 AI。纯 Markdown；顶栏「产品文档」可预览/下载。

| 文档 | 说明 | 直达 |
|------|------|------|
| [prd-observatory.md](./prd-observatory.md) | 观测台主模块 PRD | `/docs/prd-observatory.md` |
| [prd-all.md](./prd-all.md) | 合集 | `/docs/prd-all.md` |

## 本地 Demo

```bash
cd apps/mcp-tool-observatory-demo
npx --yes serve -l 5188 .
# http://localhost:5188/
```

## 给 AI

1. 顶栏 **产品文档** → 下载合集  
2. `curl http://localhost:5188/docs/prd-all.md`  
3. 拖拽本目录 `.md` 进对话
