# 知趣 · 好奇心学习机

面向成年人探索陌生领域的可玩网页原型。通过预测、操作、解释、迁移和自我表达，完成一次短小的科普启蒙体验。

## 已实现

- 五个可玩入口：星光与时间、概率直觉、历史证据、概念分类、方法示范。
- 光程滑块、独立抛硬币模拟、虚构史料对照卡。
- 针对选项的反馈、可选提示、新情境任务、自由表达与自查。
- 兼容 v1/v2 JSON 学习脚本；全量错误诊断、修复指令、导入、播放与导出。
- 用户可配置 DeepSeek、OpenAI 或自定义兼容 API，测试连接后直接生成。
- “选学法 → 编排 → 审校 → 格式检查”工作流，结构不合格时自动修复一次。
- 可复制的 AI 工作流指令；可选服务端“检索 → 编排 → 审校”生成流程。
- 响应式布局、键盘操作、来源链接和简化条件。

## 本地运行

需要 Node.js 22.13 或更新版本。

```sh
npm run install:ci
npm run dev
```

默认预览地址为 http://localhost:5173/ 。Windows 若 npm 的启动包装脚本不可用，可直接使用已安装 npm 的 `npm-cli.js` 执行安装；应用本身可以通过 `node scripts/run-framework.mjs dev` 启动。

```sh
node --test tests/lesson.test.mjs
node node_modules/typescript/bin/tsc --noEmit
node scripts/run-framework.mjs build
```

## 配置自动生成

### 用户自己的 API（网页内设置）

点击右上角“AI 设置”，选择服务、填写 API 地址、密钥和模型，点击“测试连接”，再“保存配置”。进入自定义主题后点击“生成我的探索”。DeepSeek 默认模型为 `deepseek-flash`；模型名称可修改。兼容接口使用 Chat Completions 协议，JSON 模式可关闭。

密钥默认只在当前页面内存保留；勾选“记住配置”后，会以明文保存在本站的 localStorage。可随时清除。切换服务或 API 地址会清空输入的密钥。DeepSeek 和 OpenAI 的固定官方端点由本站临时转发，密钥不写入本站服务器存储；任意自定义地址通过浏览器直连，要求 HTTPS 和 CORS 支持。不提供任意地址的服务端代理。

每次测试调用一次 API；生成通常调用三次（计划、编排、审校），结构错误最多追加一次修复。支持取消和超时；服务商可能仍对已发出的请求计费。普通聊天 API 路径没有搜索工具，生成结果会标注“未联网核验”，不附带模型编造的引用。此标记随导出和重新导入保留。测试覆盖使用模拟响应；当前开发环境没有真实用户密钥。

### 可选的网站统一 AI

在服务端配置 `.env.example` 中的 `OPENAI_API_KEY` 和 `OPENAI_MODEL`。所选模型需要支持 Responses API、web_search、JSON Schema 结构化输出。使用私有部署时，在运行环境配置对应值。

未配置网站统一 AI 时，用户仍可填写自己的 API，或使用全部内置示例、复制生成指令和导入 JSON。

网站统一 AI 每次生成最多涉及三次模型请求，使用服务端密钥进行联网检索。学习者的自由解释不自动上传。当前学习进度只在页面内存中，刷新或返回首页会清除。

## 设计与证据

详见 [工作流说明](docs/WORKFLOW.md)。流程借鉴主动回想、好奇心和迁移任务的研究，但未验证本产品对学习效率的提升。不将一次体验完成描述为精通学科。

## 主要文件

- `app/page.tsx`：探索入口、学习播放器、脚本工坊。
- `lib/lesson.ts`：旧版脚本协议，保持兼容。
- `lib/adaptive.ts`：v2活动协议、教学策略和完整提示词示例。
- `lib/script.ts`：双版本导入、全量错误报告与修复指令。
- `app/adaptive-player.tsx`：按脚本活动序列执行不同学习路径。
- `lib/lessons.ts`：三个示例脚本。
- `app/api/generate/route.ts`：可选的服务端生成工作流。
- `docs/WORKFLOW.md`：产品假设、研究依据、内容边界及验证计划。

Site 标识保存在 `.openai/hosting.json`，后续修改应复用现有 Site。
