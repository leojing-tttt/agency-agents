# 设计规格 · 竞品社媒投放监控（A3 SaaS 演示层）

| 项 | 内容 |
|----|------|
| 产品 | A3 SaaS · 竞品投放监控 |
| 平台 | Web（桌面优先，列表/表单可在窄屏纵向堆叠） |
| 实现层 | **演示层**：静态 HTML + `a3-*` + Font Awesome；产品落地用 antd Layout / ProTable |
| 文档状态 | 与当前 Demo 对齐 |

---

## 1. Purpose Statement

让运营在 A3 内配置竞品品牌与品牌词，按自定周期与抓取上限拉取小红书笔记，并在详情页用走势、达人金字塔、词云判断竞品投放结构——不是舆情告警，也不是热帖榜。

## 2. Aesthetic Direction

**A3 SaaS 工作台**：粉系主色、浅灰内容底、白底 PageContainer、侧栏信息架构。  
覆盖 ui-design-guide 默认禁令的原因：本功能嵌入已有 A3 品牌与组件规范（主色 `#c9677d`、演示字体栈含 PingFang SC / 系统 UI）。

明确不做：紫系渐变、玻璃拟态、居中落地页式营销排版、emoji 图标。

## 3. Color Palette

| Token | 值 | 用途 |
|-------|-----|------|
| `--a3-primary` | `#c9677d` | 主按钮、链接、选中、图表主系列 |
| `--a3-primary-light` | `#fff8f0` | 选中行/菜单背景 |
| Tabs 并存强调 | `#dc8249` | 顶栏系统 Tab 激活（壳层） |
| `--a3-danger` | `#ff4d4f` | 删除确认 |
| `--a3-bg-body` | `#F0F2F5` | 内容区底 |
| `--a3-bg-card` | `#FFFFFF` | 列表/看板容器 |
| 金字塔：底/中/头 | `#E8B4BE` / `#c9677d` / `#8B3A4A` | 达人分层 |

## 4. Typography

演示层沿用 `a3-components.css`：`-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif`。  
字号：页标题 16–18px / 正文 14px / 辅助 12px。

## 5. Layout Strategy

```
Header 48px（Logo + 系统 Tabs 近似 + 产品文档 + 用户）
└── Sider 200px + Content
    ├── 竞品列表（默认）
    └── 竞品详情（PageContainer：配置摘要 | 看板三块 | 笔记表）
```

- 列表：工具栏「新建竞品」+ 表 + 操作列（查看 / 编辑 / 删除）
- 新建/编辑：居中 Modal（品牌、品牌词、频次、单次抓取上限、达人分层阈值）
- 详情：上摘要条 → 看板三模块纵向 → 笔记表格；返回列表

## 6. Motion

- Modal / 抽屉：200ms ease-out 淡入
- 菜单选中：背景与右边框切换，无弹跳
- 走势图：首次进入详情时折线描边短暂绘制（CSS/SVG）

## 7. Prototype Scope

可点：列表 CRUD 本地态、详情看板与笔记、顶栏「产品文档」。  
不可点/mock：真实 TikHub 抓取、登录鉴权、权限菜单生成。
