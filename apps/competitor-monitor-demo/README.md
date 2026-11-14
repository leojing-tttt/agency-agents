# 竞品投放监控 · A3 SaaS 前端演示

静态可点原型 + 产品文档。对齐 A3 SaaS UI **演示层**（`a3-*` + Font Awesome）；产品 monorepo 落地请用 antd Layout / ProTable / Modal。

**不含后端**：抓取调度见 `docs/prd-backend-contract.md`，交给后端同学。

## 本地运行

```bash
cd apps/competitor-monitor-demo
python3 -m http.server 8765 --bind 127.0.0.1
```

打开：http://127.0.0.1:8765/

产品文档：顶栏 **产品文档**，或合集 http://127.0.0.1:8765/docs/prd-all.md

## 能力范围

| 页面 | 可点行为 |
|------|----------|
| 竞品列表 | 搜索、新建、编辑、删除、进详情 |
| 配置 Modal | 品牌、多品牌词、周/双周、单次上限/词、达人分层阈值、启用开关 |
| 详情 | 走势图、达人金字塔、词云、笔记表；编辑配置后分层重算 |
| 产品文档 | 预览 / 下载当前 / 下载合集 / 原始 MD |

数据存在浏览器 `localStorage`（`a3-cm-competitors-v1`），刷新保留。

## 目录

```
index.html          # 壳 + 列表 + 详情 + Modal
app.js              # 演示交互
styles.css          # 页面布局（演示）
assets/a3-components.css
docs/               # PRD + 设计规格 + 合集
```
