# 知趣 · 好奇心学习机

面向成年人探索陌生领域的可玩网页原型。通过预测、操作、解释、迁移和自我表达，完成一次短小的科普启蒙体验。

## 已实现

- 五个可玩入口：星光与时间、概率直觉、历史证据、概念分类、方法示范。
- 光程滑块、独立抛硬币模拟、虚构史料对照卡。
- 针对选项的反馈、可选提示、新情境任务、自由表达与自查。
- 兼容 v1/v2 JSON 学习脚本；全量错误诊断、修复指令、导入、播放与导出。
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

在服务端配置 `.env.example` 中的 `OPENAI_API_KEY` 和 `OPENAI_MODEL`。所选模型需要支持 Responses API、web_search、JSON Schema 结构化输出。使用私有部署时，在运行环境配置对应值。

未配置时，所有内置示例与脚本导入仍可使用。自定义主题可以生成一段完整指令，交给支持联网检索的 AI，再粘贴返回的 JSON。当前环境未提供模型密钥，未验证真实模型调用。

每次直接生成最多涉及三次模型请求，可能产生 API 费用。密钥只在服务端读取；学习者的自由解释不自动上传。当前学习进度只在页面内存中，刷新或返回首页会清除。

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
