# zhiqu · 知趣好奇心学习机

面向成年人探索陌生领域的可玩网页原型。通过预测、操作、解释、迁移和自我表达，完成一次短小的科普启蒙体验。

每一节都由一段 JSON 学习脚本驱动，走同一条路：**有意思的具体问题 → 先猜 → 对照或动手 → 简短解释 → 换个新情境用一次 → 用自己的话讲出来**。内置示例可离线试玩；接上自己的 AI 后，任意主题都能现场编排成一段这样的体验。

## 已实现

- 五个可玩入口：星光与时间、概率直觉、史料对照（固定六步流程），以及光年概念辨析、历史结论调查（自适应路径，各有不同的学法与活动）。
- 光程滑块、独立抛硬币模拟、虚构史料对照卡；v2 路径另有分类、示范、材料核查等活动。
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

```sh
npm test              # 全部测试（node:test + tsx，无需额外测试框架）
npm run typecheck     # tsc --noEmit
npm run lint          # eslint（已排除 dist/ 与平台生成物）
npm run build         # 产出 dist/（Worker 服务端 + 静态客户端）
npm run preflight     # 部署前自检：路由是否在包内、有无 edge 非法参数
npm run check         # 上面五步串联执行
```

Windows 若 npm 的启动包装脚本不可用，可直接使用已安装 npm 的 `npm-cli.js`；应用本身可以通过 `node scripts/run-framework.mjs dev` 启动。

### 部署前为什么要跑 preflight

`redirect: "error"` 这个取值在 Node 里合法、在 Cloudflare Workers（edge）运行时非法，`fetch` 会在发出请求前抛 `TypeError`，表现为线上 502「AI 服务响应失败」而本地测试全绿。`npm run preflight` 会检查产物里的路由、redirect 取值、3xx 防护、密钥是否泄漏进客户端，并对比源码常量。**改动 AI 相关代码后请先跑它再部署。**

## 部署

产物 `dist/` 是一个标准 Cloudflare Worker（`dist/server/index.js` + `dist/client/` 静态资源），不依赖 D1、KV 或任何 binding，因此可以部署到任何能跑 Worker 的环境，不必绑定在当前平台上。

```sh
npm run build && npm run preflight   # 先自检
npx wrangler deploy --config dist/server/wrangler.json   # 需要一次 Cloudflare 账号授权
npx wrangler dev --config dist/server/wrangler.json --local --persist-to .wrangler/state   # 本地跑生产产物
```

`npm start` 等价于上面最后一条，默认 http://127.0.0.1:8787/ 。

构建会清空并重写 `dist/`；若报 `EPERM: dist`，说明有正在运行的生产实例（`npm start`）占着目录，先停掉它。注意 `npm run dev` 的开发服务器不占用 `dist/`。

当前部署在平台侧（Site 标识保存在 `.openai/hosting.json`，后续修改应复用现有 Site）；仓库内没有平台部署脚本，上传需在平台侧发起。

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

### 一个必须遵守的渲染约束

`localStorage` 只能在 `useEffect` 里读，**不能放进 `useState` 的初始化函数**。初始化函数在服务端渲染时也会执行，那里读不到 localStorage，于是服务端与客户端首帧不一致，直接触发水合失败（表现为整棵组件树被客户端重建、报“Hydration failed”）。

正确写法是首屏一律按“没有本地配置”渲染，挂载后再补读：`app/page.tsx` 里的 AI 连接配置就是这么做的，并且为此**显式关闭了 `react-hooks/set-state-in-effect` 这一条 lint 规则**——这是官方推荐的例外，不要为了消除该警告而改回初始化里读取。

## 许可证

[AGPL-3.0](LICENSE) © 2026 zhiqu contributors。

你可以自由使用、修改和分发，但**如果你把它改成在线服务提供给他人使用，你也必须以 AGPL-3.0 公开你的完整源码**（第 13 条）。这正是选择这个许可证的原因：避免有人拿它做成闭源的商业服务。

如果公开部署，建议在界面上提供一个指向源码仓库的“源代码”链接，以符合第 13 条的要求。

## 主要文件

- `app/page.tsx`：探索入口、学习播放器、脚本工坊、AI 设置入口。
- `lib/lesson.ts`：旧版脚本协议，保持兼容；同时提供服务端生成用的 JSON Schema 与提示词。
- `lib/adaptive.ts`：v2 活动协议、教学策略和完整提示词示例。
- `lib/script.ts`：双版本导入、全量错误报告与修复指令。
- `lib/ai-connection.ts`：连接配置校验、端点归一化、请求体构造、上游错误映射、重定向防护。
- `lib/ai-client.ts`：带中转/直连两种路径的请求封装，以及三次调用 + 一次自动修复的生成编排。
- `app/adaptive-player.tsx`：按脚本活动序列执行不同学习路径。
- `app/ai-settings.tsx`：网页内 AI 连接设置与“测试连接”。
- `lib/lessons.ts`：三个旧版（v1）脚本，其中两个仍在首页目录中使用（光程、抛硬币）。
- `lib/adaptive-lessons.ts`：三个 v2 自适应示例（概念辨析、史料核查、调查方法）。
- `samples/liberalism-basics-1.json`：一份可直接导入试玩的学习脚本样例（“什么是自由主义”），用“导入脚本”粘贴即可播放。
- `app/api/ai/chat/route.ts`：官方端点的服务端临时转发（白名单，仅 DeepSeek/OpenAI 固定地址）。
- `app/api/generate/route.ts`：可选的服务端生成工作流。
- `scripts/preflight.mjs`：部署前自检。
- `docs/WORKFLOW.md`：产品假设、研究依据、内容边界及验证计划。

Site 标识保存在 `.openai/hosting.json`（托管平台生成的站点清单，含 `project_id` 与可选的 D1/R2 绑定名），后续修改应复用现有 Site。该文件是可选的：`vite.config.ts` 在它缺失时回退为空配置，因此**克隆本仓库后直接 `npm run install:ci && npm run dev` 即可运行**；只有需要重新部署到原托管平台时才用得上它。
