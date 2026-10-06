# 业财系统 · 工时归集 — A3 SaaS UI console demo

Uses **A3 SaaS UI** from `apps/campaign-agent/public/a3-components.css`（《A3 SaaS UI 规范 Skill》样式库）：玫瑰红主色、`a3-*` 组件类、Font Awesome。

## Open

```bash
cd apps/yecai-workhour-demo
npx --yes serve -l 5179 .
# http://localhost:5179/
# 高管日报：#fin-overview | #fin-revenue | #fin-cash | #fin-margin（切换身份 CEO / CFO）
```

## Skill / design source

- `/workspace/apps/campaign-agent/public/a3-components.css`（规范来源标注：《A3 SaaS UI 规范 Skill》）
- Pattern reference: `/workspace/apps/campaign-agent/public/index.html`
- User preference: A3 UI via A3-saas-ui / `@tencent-adm/ui-design-guide`（registry 不可用时以仓库 vendored CSS 为准）
