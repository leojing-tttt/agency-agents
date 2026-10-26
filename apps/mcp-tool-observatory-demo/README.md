# MCP 工具观测台 — A3 SaaS UI console demo

平台管理员向的自定义 MCP `tools/call` 观测台（方案 A）。演示层使用 **A3 SaaS UI**（`a3-components.css`，品牌 `#c9677d`），视觉与交互族对齐 `apps/yecai-workhour-demo`。

## Open

```bash
cd apps/mcp-tool-observatory-demo
npx --yes serve -l 5188 .
# http://localhost:5188/
# 默认：平台管理员台 · 总览
# 直达：#overview | #calls | #tools | #settings | #my-calls
# 顶栏「产品文档」：预览 / 下载 PRD（docs/*.md，合集可喂给 AI）
# 顶栏视图切换：平台管理员台 ↔ 我的调用（用户 stub）
```

## Nav

```
MCP 工具观测台
├── 总览
├── 调用流水
├── 工具档案
├── 设置
└── 我的调用（用户 stub，顶栏切换）
```

## Skill / design source

- A3 SaaS UI skill（演示层 `a3-*` + Font Awesome）
- Design: Project store `docs/mcp-tool-observatory-design.md`（方案 A + PM 锁定）
- Pattern reference: `apps/yecai-workhour-demo/`
