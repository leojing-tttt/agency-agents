# AGENTS.md

> 给 AI coding agent 的项目说明，等价于"团队新成员入职手册"，但读者是 AI。  
> 两条铁律：① 只写 AI 猜不到的、或与语言默认不同的东西；② 命令必须可直接复制粘贴。
>
> 兼容：Cursor / Claude Code / OpenAI Codex / Gemini CLI / Aider / Zed 等 30+ 工具。  
> 格式：纯 Markdown，无强制 schema，标题随意；嵌套文件就近生效（monorepo 友好）。

## 1. Project Overview 项目概览

这是一个面向广告公司内部效率的 AI Agent 应用，核心能力：<一句话讲清解决谁的问题>。  
当前阶段：MVP 原型——优先跑通主流程，暂不追求性能、并发和美化。

## 2. Tech Stack 技术栈

- 语言：Python 3.12（或 TypeScript 5.x，二选一，删掉不用的）
- 包管理：uv（Python）/ pnpm 9（Node）
- 关键依赖：<框架>、<LLM SDK>、<数据库>
- 密钥管理：见 `.env.example`；任何真实密钥一律不得提交

## 3. Commands 常用命令

- 安装依赖：`uv sync`
- 启动开发：`uv run uvicorn app.main:app --reload`
- 跑测试：`uv run pytest tests/ -v`
- 格式化：`uv run ruff format .`
- 静态检查：`uv run ruff check .`

## 4. Code Style 代码规范

- 全部函数加类型注解；公共函数必须有 docstring
- 命名：变量/函数 snake_case，类 PascalCase
- 单一职责，单文件不超过 300 行
- 不引入新依赖，除非先说明理由

## 5. Testing 测试

- 测试放 `tests/`，与被测文件同名
- 每个新功能至少配 1 个测试
- 提交前 `pytest` 必须全绿

## 6. Git & PR

- 分支：`feat/<scope>`、`fix/<scope>`
- 提交：Conventional Commits（`feat:` / `fix:` / `refactor:`）
- PR 必须写清：改了什么 / 为什么 / 怎么测的

## 7. Boundaries & Security 边界与安全

- 禁止提交：密钥、token、客户真实数据、`.env`
- 涉及客户数据一律用脱敏样例
- 不要动：`/infra/**`、`*.lock`、CI 配置（除非明确要求）
- 破坏性操作（删文件、改数据库 schema）必须先确认

## 8. Gotchas 已知陷阱

- <坑1：如某 SDK 流式输出必须手动 flush>
- <坑2：如本地必须先跑迁移脚本再启动服务>

## 9. Working Agreement 协作方式

- **动手前先给计划（plan first）**，确认后再写代码
- 每完成一个小功能立刻运行验证，不要攒着一起改
- 遇到歧义先问，不要自己假设
- 回复用中文，代码注释用英文
