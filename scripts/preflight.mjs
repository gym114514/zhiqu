// 部署前自检：把“只有运行时才会炸”的规则变成可静态检查的闸门。
// 起因：redirect:"error" 在 edge 运行时非法，Node 里测试全绿，线上却 502。
// 用法：npm run build && npm run preflight
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const checks = [];
const check = (name, run) => {
  try {
    const detail = run();
    checks.push({ ok: true, name, detail: detail ?? "" });
  } catch (error) {
    checks.push({ ok: false, name, detail: error.message });
  }
};
const assert = (condition, message) => { if (!condition) throw new Error(message); };

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}
const read = (path) => readFileSync(join(root, path), "utf8");

// 1. 构建产物存在
check("构建产物存在（dist/server/index.js）", () => {
  assert(existsSync(join(root, "dist/server/index.js")), "缺少 dist/server/index.js，请先运行 npm run build");
  return `${(statSync(join(root, "dist/server/index.js")).size / 1024).toFixed(0)} KB`;
});

// 2. 服务端包含全部 API 路由
const requiredRoutes = ["/api/ai/chat", "/api/generate"];
check(`服务端包含路由 ${requiredRoutes.join("、")}`, () => {
  const bundle = read("dist/server/index.js");
  for (const route of requiredRoutes) {
    assert(bundle.includes(route), `服务端产物缺少路由 ${route}（旧构建会导致线上 404 HTML）`);
  }
  return requiredRoutes.join("、");
});

// 3. 不得再出现 edge 运行时会拒绝的 fetch 取值
// 注意：只查代码形态，不查注释——源码注释里会提到这个历史坑。
const CODE_REDIRECT_ERROR = /redirect\s*:\s*["'`]error["'`]/;
const CODE_REDIRECT_MANUAL = /redirect\s*:\s*(?:["'`]manual["'`]|[A-Za-z_$][\w$]*)/;
const stripComments = (text) => text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
check("产物中不含 edge 非法的 redirect 取值", () => {
  const offenders = [];
  for (const file of walk(join(root, "dist"))) {
    if (!/\.(js|mjs|json)$/i.test(file)) continue;
    if (CODE_REDIRECT_ERROR.test(readFileSync(file, "utf8"))) offenders.push(relative(root, file));
  }
  assert(offenders.length === 0, `以下产物仍使用 redirect:"error"（edge 会抛 TypeError）：${offenders.join("、")}`);
  return "已全部改为 manual + 3xx 显式拦截";
});

// 4. 重定向防护必须真的进了某个产物（可能在客户端 chunk 里）
check("产物中包含重定向防护（manual + 3xx 拦截）", () => {
  const withGuard = [];
  for (const file of walk(join(root, "dist"))) {
    if (!/\.(js|mjs)$/i.test(file)) continue;
    const text = readFileSync(file, "utf8");
    if (CODE_REDIRECT_MANUAL.test(text) && /status\s*>=\s*300/.test(text)) withGuard.push(relative(root, file));
  }
  assert(withGuard.length > 0, "没有任何产物同时包含 redirect:manual 与 3xx 状态检查");
  return withGuard.length + " 个产物含防护（" + withGuard.map((f) => f.split(/[\\/]/).pop()).slice(0, 2).join("、") + " 等）";
});

// 5. 客户端与服务端产物都应有前端入口
check("客户端产物存在", () => {
  const clientDir = join(root, "dist/client");
  assert(existsSync(clientDir), "缺少 dist/client");
  const js = walk(clientDir).filter((f) => f.endsWith(".js"));
  assert(js.length > 0, "dist/client 内没有 JS 产物");
  return `${js.length} 个 JS 文件`;
});

// 6. 服务端配置指向客户端资源
check("wrangler 配置的 assets 指向 ../client", () => {
  const config = JSON.parse(read("dist/server/wrangler.json"));
  assert(config.assets?.directory === "../client", `assets.directory = ${config.assets?.directory ?? "未设置"}`);
  return `main=${config.main} · assets=${config.assets.directory}`;
});

// 7. 源码级防线：全库不得再写 redirect:"error"（只查代码，注释里提到不算）
check("源码中不含 redirect:\"error\"", () => {
  const self = relative(root, new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
  const targets = ["lib", "app", "scripts", "tests"].filter((d) => existsSync(join(root, d)));
  const offenders = [];
  for (const dir of targets) {
    for (const file of walk(join(root, dir))) {
      if (!/\.(ts|tsx|mjs|js)$/.test(file)) continue;
      if (relative(root, file) === self) continue;
      if (CODE_REDIRECT_ERROR.test(stripComments(readFileSync(file, "utf8")))) offenders.push(relative(root, file));
    }
  }
  assert(offenders.length === 0, `源码仍在写 redirect:"error"：${offenders.join("、")}`);
  return "统一使用 REDIRECT_MODE";
});

// 7b. 常量的定义值必须仍然是 manual —— 上面那条查的是写法，这条查的是实际取值
check("REDIRECT_MODE 的取值是 manual", () => {
  const source = read("lib/ai-connection.ts");
  const match = /REDIRECT_MODE\s*=\s*["'`]([a-z]+)["'`]/.exec(source);
  assert(match, "lib/ai-connection.ts 里找不到 REDIRECT_MODE 的字面量定义");
  assert(match[1] === "manual", `REDIRECT_MODE = "${match[1]}"；edge 运行时只接受 manual 或 follow`);
  return `REDIRECT_MODE = ${match[1]}`;
});

// 8. 服务端密钥不得进入客户端产物
check("服务端密钥未泄漏进客户端产物", () => {
  const clientDir = join(root, "dist/client");
  const hits = walk(clientDir)
    .filter((f) => /\.(js|mjs)$/i.test(f))
    .filter((f) => /OPENAI_API_KEY|sk-[A-Za-z0-9]{16,}/.test(readFileSync(f, "utf8")));
  assert(hits.length === 0, `客户端产物疑似包含密钥：${hits.map((f) => relative(root, f)).join("、")}`);
  return "未发现密钥字面量";
});

// 9. 可部署性：产物必须能被 wrangler 独立打包（这是脱离单一平台的前提）
check("产物可被 wrangler 独立打包（dry-run）", () => {
  const out = join(root, ".wrangler", "preflight-dry");
  const result = spawnSync(process.execPath, [
    join(root, "node_modules", "wrangler", "bin", "wrangler.js"),
    "deploy", "--dry-run", "--outdir", out, "--config", join(root, "dist", "server", "wrangler.json"),
  ], { cwd: root, encoding: "utf8", env: { ...process.env, WRANGLER_SEND_METRICS: "false" } });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  assert(result.status === 0, `wrangler dry-run 失败：${output.split("\n").filter(Boolean).slice(-3).join(" / ")}`);
  const size = /Total Upload:\s*([\d.]+ \w+)/.exec(output)?.[1] ?? "未知";
  return `可打包，上传体积 ${size}`;
});

// 9. 首页 HTML 引用的静态资源必须真的存在于磁盘上
// 起因：重建 dist/ 时若有生产实例在运行，dist/client 会被清空而 HTML 仍引用旧文件名，
// 结果线上页面没有 CSS/JS，UI 完全错乱（但服务端仍返回 200）。
check("首页引用的静态资源在磁盘上存在", () => {
  assert(existsSync(join(root, "dist/server/index.js")), "缺少 dist/server/index.js");
  const rendered = spawnSync(process.execPath, ["-e", `
    const { pathToFileURL } = require("node:url");
    (async () => {
      const mod = await import(pathToFileURL(${JSON.stringify(join(root, "dist/server/index.js"))}).href);
      const handler = mod.default ?? mod;
      const fetcher = typeof handler?.fetch === "function" ? handler.fetch : handler;
      const response = await fetcher(new Request("http://localhost/"), {});
      process.stdout.write(await response.text());
    })().catch((error) => { process.stderr.write(String(error?.stack ?? error)); process.exit(1); });
  `], { cwd: root, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
  const markup = rendered.stdout ?? "";
  assert(rendered.status === 0 && markup.length > 0,
    "无法从产物渲染首页 HTML" + ((rendered.stderr ?? "").split("\n")[0] ? `：${(rendered.stderr ?? "").split("\n")[0]}` : ""));
  const refs = [...new Set([...markup.matchAll(/(?:href|src)="(\/[^"]+\.(?:css|js))"/g)].map((m) => m[1]))];
  assert(refs.length > 0, "首页 HTML 未引用任何 css/js 资源（构建可能不完整）");
  const missing = refs.filter((ref) => !existsSync(join(root, "dist", "client", ref.replace(/^\//, "").split("?")[0])));
  assert(missing.length === 0, `以下资源被引用但不在 dist/client 中（页面会没有样式/脚本）：${missing.join("、")}`);
  return `${refs.length} 个引用全部存在`;
});

const failed = checks.filter((c) => !c.ok);
for (const c of checks) console.log(`${c.ok ? "✔" : "✖"} ${c.name}${c.detail ? `  — ${c.detail}` : ""}`);
console.log(`\n部署前自检：${checks.length - failed.length}/${checks.length} 项通过`);
if (failed.length) {
  console.log("\n先修好上面的问题再部署；否则这些缺陷只会在线上以 502 / 404 的形式暴露。");
  process.exitCode = 1;
}
