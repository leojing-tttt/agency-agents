# 竞品投放监控 · 产品需求文档索引

> 供程序员与 AI。纯 Markdown；顶栏「产品文档」可预览/下载。

| 文档 | 说明 | 直达 |
|------|------|------|
| [prd-overview.md](./prd-overview.md) | 总览与边界 | `/docs/prd-overview.md` |
| [prd-list-create.md](./prd-list-create.md) | 列表与配置 | `/docs/prd-list-create.md` |
| [prd-detail-dashboard.md](./prd-detail-dashboard.md) | 详情与看板 | `/docs/prd-detail-dashboard.md` |
| [prd-backend-contract.md](./prd-backend-contract.md) | 后端交接契约 | `/docs/prd-backend-contract.md` |
| [design-spec.md](./design-spec.md) | 设计规格 | `/docs/design-spec.md` |
| [prd-all.md](./prd-all.md) | 合集 | `/docs/prd-all.md` |

## 给 AI

1. 顶栏 **产品文档** → 下载合集  
2. `curl http://127.0.0.1:8765/docs/prd-all.md`  
3. 拖拽本目录 `.md` 进对话  

## 本地 Demo

```bash
cd apps/competitor-monitor-demo
python3 -m http.server 8765 --bind 127.0.0.1
# 打开 http://127.0.0.1:8765/
```
