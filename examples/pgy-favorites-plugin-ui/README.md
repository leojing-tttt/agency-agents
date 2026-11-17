# 蒲公英插件 · 收藏夹 / 我的更新（高保真原型）

演示层静态稿，对齐 **方案 A（信息架构微调）** + **顶栏分段导航**。

## 打开方式

```bash
cd examples/pgy-favorites-plugin-ui
python3 -m http.server 8765 --bind 127.0.0.1
# 浏览器打开 http://127.0.0.1:8765/
# 更新页：http://127.0.0.1:8765/?view=updates
```

## 页面

| 视图 | 说明 |
|------|------|
| 收藏夹 | 左夹列表（超限告警/容量条）+ 右达人表（状态摘要、选中条、更新引导） |
| 我的更新 | 任务列表：状态 / 进度 / 下载 / 重试 |

## 交互可点

- 顶栏切换「收藏夹 / 我的更新」
- 切换左侧收藏夹（超限态 vs 正常态副标题）
- 勾选达人 → 出现「已选择 N 条」并点亮批量按钮
- 「更新数据」→ toast + 角标 + 可跳转更新页

## 高保真截图

| 视图 | 文件 |
|------|------|
| 收藏夹（超限态） | [`screenshots/pgy-favorites-hi-fi.png`](./screenshots/pgy-favorites-hi-fi.png) |
| 收藏夹（已选中） | [`screenshots/pgy-favorites-selected-hi-fi.png`](./screenshots/pgy-favorites-selected-hi-fi.png) |
| 我的更新 | [`screenshots/pgy-updates-hi-fi.png`](./screenshots/pgy-updates-hi-fi.png) |

## 说明

- 使用 `a3-components.css` + Font Awesome，属 **演示层**，非产品 monorepo 组件 API。
- 品牌色 `#c9677d`。
