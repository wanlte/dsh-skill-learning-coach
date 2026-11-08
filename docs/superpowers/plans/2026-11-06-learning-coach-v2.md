# Learning Coach v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 learning-coach 从"问四问给路线"升级成记得学习者卡在哪、按目的定达标标准、并且真的带练的贴身教师；路线框架与学习方法在 DSH 原生设置卡里可视化编辑，落盘到工作区，下次会话 AI 读得到。

**Architecture:** 一个 npm 包，三块职责分离。**host 半**只注册一条 fenced 前缀路由 `/learning-coach/api`，两个方法 `state.read` / `state.write`，读写 `<会话工作区>/learning/framework.json`（原子写 + schema 校验）。**客户端半**在 `settings.section`（设置侧边栏一级页面，与模型等并列）注册一张设置卡，所有渲染发生在浏览器，AI 零 output token；改动立刻 POST 给 host。**skill bundle** 是短路由 `SKILL.md` + 按需读的 `references/`，AI 每轮只读当前节点。状态真源只有磁盘上那一个 JSON 文件，客户端不存 localStorage。

**Tech Stack:** TypeScript 5.6（strict + noUncheckedIndexedAccess）、React 18、cordis ~4.0.5、tsc（host + 类型）+ tsdown/rolldown（客户端 CJS closure bundle）、lightningcss（CSS Modules）、`node --test`（零额外测试依赖）。

**Spec:** `docs/superpowers/specs/2026-11-06-learning-coach-v2-design.md`

> **2026-11-08 修订（用户已批准，spec §13）：** 设置卡入口从 `settings.plugins.tab`（"设置 → 内置插件"页内的 tab）迁到 `settings.section`（设置侧边栏一级页面，与模型等并列）。Task 1 已按原设计执行完毕，正文保留原貌作历史记录；迁移落点在 Task 4（Step 3 静态测试 → Step 4 卡片接住 `close` → Step 5 迁 `src/client/index.ts`），`SettingsCardProps` 随之增加 owner 注入的 `close`，测试总数 25 → 27。Task 1 正文中的 plugins.tab 注册（`ctx.slots.inject('settings.plugins.tab'` 那一段）由 Task 4 替换，**不要回改 Task 1**。

## Global Constraints

以下每条对所有 Task 生效，值逐字来自 spec：

- 包名 `dsh-skill-learning-coach`，版本 `0.2.0`。
- 状态文件唯一：`<工作区>/learning/framework.json`；讲义落 `learning/讲义/<YYYY-MM-DD>-<节点标题>.md`。
- `purpose.kind` ∈ `job | exam | interest | career-switch`；`exam` 的 `detail` 必须含考试名，`job` 的必须含目标岗位。
- `method` ∈ `feynman | recall | spaced | interleave | pomodoro | sq3r | cornell | custom`；选 `custom` 时 `customMethod` 必须非空，否则必须为 `null`。
- `status` 状态机：`pending` → 问完默认 `assumed-known`；学习者说没懂 → `gap`；生成讲义 → `drafted`；无提示产出达标 → `done`。**给到阶梯提示第三级（答案）则标 `gap`，不算达标。**
- `current`：学习者在设置卡点选的优先；未点选 = 按框架顺序第一个既非 `assumed-known` 也非 `done` 的节点。
- `mastery` 必须是一件可验证的动作，禁止"读完某章""理解某概念"。`materials[].enough` 必须写清读到什么程度算够。
- `misconceptions` **只追加**，AI 不得清空或改写；这是"专属"的物理载体，下次会话必须引用。
- `reviewOn` 仅 `method: spaced` 使用；间隔表固定为达标当日 +1 / +3 / +7 / +14 / +30 天；**不引入调度器、不起后台进程**。
- 节点粒度：一节 15–25 分钟能收口。
- 省 token 七条（spec §8）：① 渲染全在客户端，AI 不生成 HTML/图表 ② 只读当前节点、不重读已读过的 reference ③ 方法库按方法分片，选哪个读哪个 ④ 长讲解写进讲义文件，聊天只留短指令 ⑤ 每轮只问一个问题、回复 ≤150 字、不复述学习者原话、不重复讲已讲过的原理、不先给答案 ⑥ 一节一 session，收口提醒开新会话 ⑦ `SKILL.md` 正文 ≤60 行、frontmatter `description` ≤80 字。
- `references/methods/*.md` 每份 ≤40 行。
- 不做：错题本、掌握度打分、批量生成整套讲义、多学习者档案、抓取付费/需登录资料。
- v1 的 `references/intake.md` 删除，`learning/00-路线.md` 不迁移、不留兼容层。
- 包内**不得**出现 HTML 模板或本地服务脚本。
- **装机与真机走查由用户自己跑**（spec §12）。agent 只把包做完；不得改用户的 profile，不得新建验证 profile。Task 1 末与 Task 9 末是交给用户的检查点。

## 写计划时已核实的结论（实施者不要再查一遍）

这些是读本机现役包源码得到的事实，附证据位置。实施时直接按此写代码。

1. **一级设置页面注册进 `settings.section`（`scope: 'root'`，list），owner props 是 `{ close: () => void }`。**
   证据：`@deepseek-ai/dsh-client-ui-settings/lib/types/client/contract/slots.d.ts:73-77`（`settings.section` 声明）与 `:154-157`（`SettingsSectionOwnerProps` 只有 `close`）。模型页（ui-settings-models）等同级页面即注册于此；`settings.plugins.tab`（:86-90，owner props 为空）只是"内置插件"区内的 tab——Task 1 探针注册在那，Task 4 迁到 `settings.section`（spec §13）。
   `ScopeStandardProps<'root'>` = `object & GlobalStandardProps`（`dsh-client-ui-slots/lib/types/index.d.ts:221`），**root 槽拿不到 `sessionId`**。
   → 所以设置卡必须自己提供一个"工作区选择器"。这就是 spec §10 那一环的答案。

2. **客户端会话列表每行带 `cwd`。**
   证据：`dsh-client-runtime/lib/types/client/sessions/service.d.ts:30-61`（`SessionSummary`：`id / displayTitle / cwd? / origin? / running / blank / updatedAt`）。
   → 卡片用 `ctx.sessions.list.getSnapshot().byId` 按 `cwd` 去重分组，每组取 `updatedAt` 最大的会话作代表，默认选最新那一组。**只把 `sessionId` 发给 host，路径永不过线**——这比 spec §4.2"校验客户端传来的 cwd"更强。
   客户端快照里**没有** current session id（`dsh-better-sidebar/src/context-types.ts:546` 明确写了这一点），不要去找。

3. **host 解析工作区的权威顺序。**
   证据：`dsh-better-sidebar/src/index.ts:213-241`。
   `ctx.sessions.get(id)` → `ctx.get('workingDirectory')?.get(session) ?? session.header.cwd` → 冷会话回落 `ctx.get('sessionPersistence')?.stat?.(id)` 的 `header.cwd`（`:163-195`）。

4. **host 服务类型用"结构镜像 + 交叉"，不要用 `declare module` 增强。**
   证据：`dsh-better-sidebar/src/context-types.ts:1-32` 的模块头注释——host `sessions: SessionStore` 与 client `sessions: ISessions` 同名不同类型，同一个程序里重新声明会 TS2717。
   cordis 的 `get` 有 `get<K extends string & keyof this>(name: K): undefined | this[K]` 重载（`cordis/lib/types/reflect.d.ts:14`），交叉类型上的可选服务能被正确推断。

5. **路由准入与分派。**
   证据：`dsh-better-sidebar/src/index.ts:1542-1583`。
   `ctx.effect(() => ctx.webServer.register({kind:'prefix', path, handler}), 'label')`；fence = `ctx.connection.requestRejection(req) === undefined`；分派表必须用 `Object.hasOwn` 守卫（否则 `POST .../constructor` 会命中 `Object.prototype`）。
   信封：成功 `{ok:true, value}`，失败 `{ok:false, error:{code,message}}`。

6. **客户端 HTTP 必须走页面 base，不能走注入的 transport origin。**
   证据：`dsh-better-sidebar/src/client/desktop-env.ts:34-57` 与 `host-route-url.ts:1-30`。
   Electron 页面是 `dsh-app://app/`，shell 把非静态路径同源转发给 host；插件路由不发 CORS 头，跨 origin fetch 会被浏览器直接拒。相对路径解析 against `document.baseURI`（带尾斜杠）同时覆盖反向代理前缀。

7. **设置卡注册与构建管线照抄 dsh-voice-announcer。**
   `src/client/index.ts:23-45`（`ctx.locale.register` + `ctx.slots.inject('settings.section', () => ctx.slots.register({...}, Component))`）、`tsdown.config.ts`（CLIENT_EXTERNALS / 纯度门 / CSS Modules / `window.__ModuleLoader__.load` banner）、`package.json` 的 `dsh.client.inject` 四项、`scripts/check-client-bundle.mjs`。voice-announcer 注册的是 plugins.tab，本包按 spec §13 用 settings.section——注册写法相同，slot 键不同。
   **它的 localStorage 偏好不能抄**——本包真源在磁盘。

8. **不需要 `settings.update`，因此避开 `.volatile()` 陷阱。**
   spec §10 退路 1 才需要它（DSH 版 schemastery 才会把 volatile 字段包成 `Volatile` 引用，公开版静默失效，见 `dsh-better-sidebar/src/config.ts:120-150`）。主方案自己写工作区文件，完全不碰 settings 服务。

9. **版本坑：不要用 `ctx.workspaces` 的类型。**
   `dsh-client-runtime@0.1.1-rc.2` 的 .d.ts 从 `@deepseek-ai/dsh-client-connection/client` 引 `WorkspaceView`，但已发布的 `dsh-client-connection@0.2.1-rc.5` 里**根本没有 workspace 类型**（已 npm pack 核实）。本计划只用 `ctx.sessions`，绕开这个 skew。

## File Structure

包根：`F:/work/dsh-skill/dsh-skill-learning-coach/`（已是 git 仓库，v1 有 9 个提交）。
**所有 pnpm / node / tsc 命令都在包根执行**（Bash 工具用 `dir_path` 参数）；git 命令统一写 `git -C F:/work/dsh-skill/dsh-skill-learning-coach ...`。

| 文件 | 职责 | 来自哪个 Task |
| --- | --- | --- |
| `package.json` | 0.2.0；main/exports 指向 lib；`dsh.client.inject` + `dsh.bundle.patch`；build/test 脚本 | 1 改，9 加 `pack:check` |
| `tsconfig.json` | strict + noUncheckedIndexedAccess + skipLibCheck；outDir lib，declarationDir lib/types | 1 |
| `tsdown.config.ts` | 客户端单 bundle，纯度门 + CSS Modules + ModuleLoader banner | 1 |
| `.gitignore` | 追加 `lib/` | 1 |
| `cordis.patch.yml` | 插入 host 插件行（让客户端 bundle 被发现）+ 保留 v1 的 skill-filesystem 实例 | 1 |
| `src/host-context.ts` | host 服务结构镜像 + `Context = CordisContext & HostContextShape`；**禁止 Node 类型** | 1 |
| `src/session-cwd.ts` | `RouteError` + `resolveCwd(ctx, sessionId)`：唯一的工作区权威解析 | 1 |
| `src/wire.ts` | `readJsonBody`（1 MiB 上限）/ `writeJson` / `writeOk` / `writeError` | 1 |
| `src/state.ts` | `resolveStatePath`（包含性检查）/ `readState` / `writeState`（原子写） | 1 建，3 加校验 |
| `src/index.ts` | host 入口：`name` / `inject` / `apply`，一条前缀路由两个方法 | 1 |
| `src/shared/framework.ts` | **零 import** 的数据模型 + 校验器 + 纯变更助手；host 与 client 共用 | 2 |
| `src/client/context-types.ts` | 客户端 type-only 声明合并 + `LocaleNamespaceMap` | 1 |
| `src/client/api.ts` | `routeUrl` / `call` / `CoachApiError` / `readState` / `saveState` | 1 |
| `src/client/locales.ts` | zh/en 字典 | 1 建，4/5 扩 |
| `src/client/SettingsCard.tsx` | 设置卡本体 | 1 探针 → 4 目的/方法 → 5 框架树 |
| `src/client/SettingsCard.module.css` | 卡片样式，用 DSH 主题变量 | 4 |
| `src/client/css-modules.d.ts` | `*.module.css` 的类型声明 | 1 |
| `src/client/index.ts` | 客户端入口：注册字典 + 注册设置侧边栏一级页面（`settings.section`） | 1 建（plugins.tab），4 迁入口 |
| `scripts/check-client-bundle.mjs` | 打包后扫描 `require()`，非模块表导入即失败 | 1 |
| `scripts/check-package.mjs` | tarball 内容清单自检：13 份 skill Markdown / 8 份方法卡 / 无 HTML | 9 |
| `tests/session-cwd.test.mjs` | resolveCwd 三级回落 + 拒绝未知会话 | 1 |
| `tests/settings-entry.test.mjs` | 入口静态断言：注册 `settings.section`、无 `settings.plugins.tab` | 4 |
| `tests/framework.test.mjs` | 模型校验器 + 变更助手 + 间隔表 | 2 |
| `tests/state.test.mjs` | 包含性检查 / 半截 JSON 报错 / 原子写 / 卡壳只追加 | 3 |
| `tests/skill-bundle.test.mjs` | SKILL.md 预算 / skills 只有 md / 六问目的优先 / framework 覆盖 | 6 |
| `tests/skill-coach.test.mjs` | 阶梯提示三级 / 只追加 / 自标行 / purpose 变形 / 复习记录行 | 7 |
| `tests/methods.test.mjs` | 8 份卡与 METHOD_IDS 一致 / ≤40 行 / 全 bundle 链接可达 | 8 |
| `skills/learning-coach/SKILL.md` | ≤60 行路由 + 每轮硬约束 | 6 |
| `skills/learning-coach/references/first-run.md` | 首次引导（目的优先） | 6 |
| `skills/learning-coach/references/framework.md` | 框架生成规则 / 粒度 / 状态机 / 依赖护栏 | 6 |
| `skills/learning-coach/references/coach-loop.md` | 行动清单 → 陪练 → 阶梯提示 → 无提示产出 → 收口 | 7 |
| `skills/learning-coach/references/materials.md` | 单页讲义模板 + 达标动作按 purpose 变形 | 7 |
| `skills/learning-coach/references/methods/{8 个 id}.md` | 每份 ≤40 行，选哪个读哪个 | 8 |
| `skills/learning-coach/references/intake.md` | **删除** | 6 |
| `README.md` | 形态说明 + 安装/回滚命令 + §11 走查清单 | 9 |

**依赖方向（不得反向）：** `shared/framework.ts` 零 import，被 host 与 client 同时引用；`session-cwd.ts` 只依赖 `host-context.ts`；`state.ts` 依赖 `shared` + `session-cwd`；`index.ts` 依赖前三者；client 只依赖 `shared` 与平台模块。**client 不得 import 任何 host 文件**（会把 Node 内置拖进浏览器 bundle，纯度门会炸）。

---

### Task 1: 打通"设置卡 → 会话工作区"这一环（真跑检查点）

**Files:**
- Modify: `package.json`（整份替换）、`.gitignore`、`cordis.patch.yml`
- Create: `tsconfig.json`、`tsdown.config.ts`、`src/host-context.ts`、`src/session-cwd.ts`、`src/wire.ts`、`src/state.ts`、`src/index.ts`、`src/client/{context-types.ts,api.ts,locales.ts,SettingsCard.tsx,css-modules.d.ts,index.ts}`、`scripts/check-client-bundle.mjs`
- Test: `tests/session-cwd.test.mjs`

**Interfaces:**
- Consumes: v1 已有的 `cordis.patch.yml` skill-filesystem 表达式（逐字保留，已实测通过）。
- Produces:
  - `RouteError(code: string, message: string, status?: number)`（默认 400），从 `lib/session-cwd.js` 导出
  - `resolveCwd(ctx: Context, sessionId: unknown): Promise<string>`
  - `readJsonBody(req): Promise<Record<string, unknown>>`、`writeJson(res, status, payload)`、`writeOk(res, value)`、`writeError(res, error)`
  - `resolveStatePath(cwd: string, relative: string): string`、`readState(cwd): Promise<StateView>`、`writeState(cwd, input: unknown): Promise<StateView>`
  - `StateView = { cwd: string; path: string; exists: boolean; framework: unknown }`（Task 3 把 `unknown` 收紧成 `Framework | null`）
  - HTTP：`POST /learning-coach/api/state.read` body `{sessionId}`；`POST /learning-coach/api/state.write` body `{sessionId, framework}`；两者都回 `{ok:true, value:StateView}`
  - 客户端：`readState(sessionId): Promise<StateView>`、`saveState(sessionId, framework): Promise<StateView>`、`CoachApiError(code, message)`

- [ ] **Step 1: 写失败测试**

创建 `tests/session-cwd.test.mjs`：

```js
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { resolveCwd, RouteError } from '../lib/session-cwd.js'

function fakeCtx({ live, committed, header, stored }) {
  return {
    sessions: { get: id => (id === 's1' ? live : undefined) },
    get: name => {
      if (name === 'workingDirectory') return committed
      if (name === 'sessionPersistence') return { stat: async () => stored }
      return undefined
    },
  }
}

test('优先用 workingDirectory 服务的已提交目录（跟踪 cd）', async () => {
  const ctx = fakeCtx({
    live: { header: { cwd: '/orig' } },
    committed: { get: () => '/committed' },
  })
  assert.equal(await resolveCwd(ctx, 's1'), '/committed')
})

test('没有 workingDirectory 服务时回落会话 header', async () => {
  const ctx = fakeCtx({ live: { header: { cwd: '/orig' } } })
  assert.equal(await resolveCwd(ctx, 's1'), '/orig')
})

test('冷会话回落持久化 header', async () => {
  const ctx = fakeCtx({ stored: { header: { cwd: '/stored' } } })
  assert.equal(await resolveCwd(ctx, 's1'), '/stored')
})

test('三级都拿不到就拒绝，绝不回落 process.cwd()', async () => {
  const ctx = fakeCtx({})
  await assert.rejects(() => resolveCwd(ctx, 's1'), err => err instanceof RouteError && err.code === 'unknown-session')
})

test('sessionId 缺失或非字符串一律拒绝', async () => {
  const ctx = fakeCtx({ live: { header: { cwd: '/orig' } } })
  for (const bad of [undefined, null, '', '   ', 42, {}]) {
    await assert.rejects(() => resolveCwd(ctx, bad), err => err.code === 'bad-request')
  }
})
```

- [ ] **Step 2: 跑测试确认它失败**

Run（包根）：`node --test tests/session-cwd.test.mjs`
Expected: FAIL — `Cannot find module .../lib/session-cwd.js`（lib 还不存在）。

- [ ] **Step 3: 工程骨架**

整份替换 `package.json`：

```json
{
  "name": "dsh-skill-learning-coach",
  "version": "0.2.0",
  "description": "DSH 引导学习插件：AI 自生成知识框架、沿框架提问、默认已懂只标缺口；路线与学习方法在原生设置卡里可视化编辑并落盘到工作区，按目的定达标标准，带卡壳档案的引导式陪练。",
  "type": "module",
  "main": "lib/index.js",
  "types": "lib/types/index.d.ts",
  "exports": {
    ".": {
      "types": "./lib/types/index.d.ts",
      "default": "./lib/index.js"
    },
    "./client": {
      "types": "./lib/types/client/index.d.ts",
      "default": "./lib/client.js"
    },
    "./cordis.patch.yml": "./cordis.patch.yml",
    "./package.json": "./package.json"
  },
  "engines": {
    "node": "^22.19.0 || >=24.0.0"
  },
  "dsh": {
    "client": {
      "inject": [
        "@deepseek-ai/dsh-client-locale",
        "@deepseek-ai/dsh-client-runtime",
        "@deepseek-ai/dsh-client-ui-settings",
        "@deepseek-ai/dsh-client-ui-settings-plugins"
      ],
      "platform": "web"
    },
    "bundle": {
      "patch": "./cordis.patch.yml"
    }
  },
  "files": [
    "lib/**/*.js",
    "lib/types/**/*.d.ts",
    "cordis.patch.yml",
    "skills/**",
    "src",
    "docs/**",
    "README.md",
    "LICENSE"
  ],
  "scripts": {
    "build": "node -e \"fs.rmSync('lib',{recursive:true,force:true})\" && tsc -p tsconfig.json && tsdown",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "pnpm run build && node --test tests/",
    "test:client-bundle": "node scripts/check-client-bundle.mjs",
    "prepack": "pnpm run build && pnpm run test:client-bundle"
  },
  "keywords": [
    "dsh",
    "deepseek-harness",
    "skill",
    "learning",
    "study",
    "roadmap",
    "feynman",
    "client-plugin"
  ],
  "license": "MIT",
  "peerDependencies": {
    "@deepseek-ai/cordis": "~4.0.5"
  },
  "peerDependenciesMeta": {
    "@deepseek-ai/cordis": {
      "optional": true
    }
  },
  "devDependencies": {
    "@deepseek-ai/cordis": "~4.0.5",
    "@deepseek-ai/dsh-api-session-controller": "^0.2.1-rc.5",
    "@deepseek-ai/dsh-client-locale": "^0.2.1-rc.5",
    "@deepseek-ai/dsh-client-runtime": "^0.1.1-rc.2",
    "@deepseek-ai/dsh-client-ui-settings": "^0.2.1-rc.5",
    "@deepseek-ai/dsh-client-ui-settings-plugins": "^0.2.1-rc.5",
    "@deepseek-ai/dsh-client-ui-slots": "^0.2.1-rc.5",
    "@types/node": "^24.0.0",
    "@types/react": "~18.3.1",
    "@types/react-dom": "~18.3.1",
    "lightningcss": "^1.32.0",
    "react": "^18.2.0",
    "react-dom": "18.2.0",
    "tsdown": "^0.22.2",
    "typescript": "^5.6.0"
  },
  "packageManager": "pnpm@11.7.0"
}
```

整份替换 `.gitignore`：

```
node_modules/
lib/
*.tgz
```

创建 `tsconfig.json`：

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2024", "DOM", "DOM.Iterable"],
    "module": "esnext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "outDir": "lib",
    "rootDir": "src",
    "declaration": true,
    "declarationDir": "lib/types",
    "allowImportingTsExtensions": true,
    "rewriteRelativeImportExtensions": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "skipLibCheck": true,
    "noEmitOnError": true,
    "isolatedModules": true,
    "types": ["node"]
  },
  "include": ["src"],
  "exclude": ["tests", "lib"]
}
```

创建 `tsdown.config.ts`（逐字抄 dsh-voice-announcer，只改 `PLUGIN_ID`）：

```ts
import { readFile } from 'node:fs/promises'
import { basename, dirname, relative, resolve as resolvePath, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { UserConfig } from 'tsdown'
import { transform } from 'lightningcss'

const PLUGIN_ID = 'dsh-skill-learning-coach'

const CLIENT_EXTERNALS = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-runtime/client',
  '@deepseek-ai/dsh-client-ui-slots',
] as const

const CSS_VIRTUAL_PREFIX = '\0dsh-css:'
const CSS_VIRTUAL_SUFFIX = '.mjs'
const REPOSITORY_ROOT = dirname(fileURLToPath(import.meta.url))

function injectTag(pluginId: string, fileId: string, cssText: string): string {
  const tagId = `${pluginId}/${basename(fileId)}`
  return [
    `const css = ${JSON.stringify(cssText)};`,
    `const tagId = ${JSON.stringify(tagId)};`,
    `if (typeof document !== 'undefined' && document.querySelector('style[data-plugin-css=' + JSON.stringify(tagId) + ']') === null) {`,
    `  const tag = document.createElement('style');`,
    `  tag.dataset.plugin = ${JSON.stringify(pluginId)};`,
    `  tag.dataset.pluginCss = tagId;`,
    `  tag.textContent = css;`,
    `  document.head.appendChild(tag);`,
    `}`,
  ].join('\n')
}

export default {
  name: `${PLUGIN_ID}/client`,
  entry: { client: 'src/client/index.ts' },
  outDir: 'lib',
  format: 'cjs',
  platform: 'browser',
  dts: false,
  sourcemap: true,
  clean: false,
  deps: {
    neverBundle: [...CLIENT_EXTERNALS],
    alwaysBundle: (id: string) => (CLIENT_EXTERNALS.includes(id as (typeof CLIENT_EXTERNALS)[number]) ? undefined : true),
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
    'import.meta.url': '(globalThis.location?.href ?? "")',
    'import.meta.env.MODE': JSON.stringify(process.env.NODE_ENV ?? 'production'),
    'import.meta.env': JSON.stringify({ MODE: process.env.NODE_ENV ?? 'production' }),
  },
  plugins: [{
    name: 'dsh-client-bundle-purity',
    resolveId(source: string) {
      if (!source.startsWith('@deepseek-ai/')) return null
      if (CLIENT_EXTERNALS.includes(source as (typeof CLIENT_EXTERNALS)[number])) return null
      throw new Error(
        `client bundle purity: "${source}" is not a platform module (CLIENT_EXTERNALS) — `
        + 'cross-plugin value imports are forbidden; collaborate through cordis services (type-only imports are erased and never reach this gate)',
      )
    },
  }, {
    name: 'dsh-css-inline',
    resolveId(source: string, importer: string | undefined) {
      if (!source.endsWith('.module.css')) return null
      const abs = importer === undefined ? source : resolvePath(dirname(importer), source)
      const repositoryPath = relative(REPOSITORY_ROOT, abs).split(sep).join('/')
      return CSS_VIRTUAL_PREFIX + repositoryPath + CSS_VIRTUAL_SUFFIX
    },
    async load(virtualId: string) {
      if (!virtualId.startsWith(CSS_VIRTUAL_PREFIX)) return null
      const repositoryPath = virtualId.slice(CSS_VIRTUAL_PREFIX.length, -CSS_VIRTUAL_SUFFIX.length)
      const fileId = resolvePath(REPOSITORY_ROOT, repositoryPath)
      this.addWatchFile(fileId)
      const source = await readFile(fileId)
      const { code, exports: cssExports } = transform({
        filename: fileId,
        code: source,
        cssModules: { pattern: '[hash]_[local]' },
        minify: true,
      })
      const classMap: Record<string, string> = {}
      for (const [local, exp] of Object.entries(cssExports ?? {})) classMap[local] = exp.name
      return [
        injectTag(PLUGIN_ID, fileId, code.toString()),
        `export default ${JSON.stringify(classMap)};`,
      ].join('\n')
    },
  }],
  outputOptions: {
    entryFileNames: 'client.js',
    banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(PLUGIN_ID)}, factory: (require) => {`,
    footer: 'return module.exports; } });',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
    codeSplitting: false,
  },
} satisfies UserConfig
```

创建 `scripts/check-client-bundle.mjs`：

```js
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')
const imports = [...source.matchAll(/\brequire\((['"])([^'"]+)\1\)/g)].map(match => match[2])
const allowed = new Set([
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-runtime/client',
  '@deepseek-ai/dsh-client-ui-slots',
])
const forbidden = [...new Set(imports.filter(id => !allowed.has(id)))].sort()

assert.deepEqual(
  forbidden,
  [],
  `client bundle contains imports missing from the DSH module table: ${forbidden.join(', ')}`,
)

console.log(`client bundle import check passed (${[...new Set(imports)].length} module-table imports)`)
```

整份替换 `cordis.patch.yml`（skill-filesystem 那段逐字保留 v1，只新增 host 行）：

```yaml
# dsh-skill-learning-coach bundle patch
# 第一行挂载 host 半（两条 fenced 路由），同时让 DSH 发现本包的客户端 bundle。
# 第二行是 v1 已实测通过的 skill 实例：从"已安装的包"反查 skills 目录，
# 不拿 baseUrl 当 skill 根（profile 层可能另存一份声明，按 patch 位置算会算错）。
- insert:
    - id: dsh-skill-learning-coach
      name: dsh-skill-learning-coach
      config: {}
    - id: skill-learning-coach-bundled
      name: '@deepseek-ai/dsh-skill-filesystem'
      config:
        providerName: learning-coach-bundled
        includeDefaultRoots: false
        watch: false
        bundledSkillDir: !!js >-
          (() => {
            const require = process.getBuiltinModule('node:module').createRequire(new URL('package.json', baseUrl))
            return require('node:path').join(require('node:path').dirname(require.resolve('dsh-skill-learning-coach/package.json')), 'skills')
          })()
```

装依赖：`pnpm install`
Expected: 成功写入 `pnpm-lock.yaml`，`node_modules/@deepseek-ai/` 下出现 8 个包。

- [ ] **Step 4: host 服务镜像与工作区解析**

创建 `src/host-context.ts`（**不得出现任何 Node 类型**，它会被 client 侧的声明图间接看到）：

```ts
import type { Context as CordisContext } from '@deepseek-ai/cordis'

export interface HttpRequest {
  url?: string
  method?: string
  headers: Record<string, string | string[] | undefined>
  [Symbol.asyncIterator](): AsyncIterator<string | Uint8Array>
}

export interface HttpResponse {
  statusCode: number
  headersSent?: boolean
  writeHead(status: number, headers?: Record<string, string>): void
  end(body?: string | Uint8Array): void
}

export interface WebRoute {
  kind: 'exact' | 'prefix'
  path: string
  handler: (req: HttpRequest, res: HttpResponse) => void | Promise<void>
}

export interface WebServerService {
  register(route: WebRoute): () => void
}

export interface SessionHeader {
  cwd?: string
}

export interface SessionStoreService {
  get(id: string): { header: SessionHeader } | undefined
}

export interface ConnectionService {
  requestRejection(request: { headers: Record<string, string | string[] | undefined> }): 401 | 403 | undefined
}

export interface WorkingDirectoryService {
  readonly defaultDirectory?: string
  get(session: { header: SessionHeader }): string
}

export interface SessionPersistenceService {
  stat?(sessionId: string): Promise<{ header: SessionHeader } | undefined>
}

export interface HostContextShape {
  webServer: WebServerService
  sessions: SessionStoreService
  connection: ConnectionService
  workingDirectory?: WorkingDirectoryService
  sessionPersistence?: SessionPersistenceService
}

export type Context = CordisContext & HostContextShape
```

创建 `src/session-cwd.ts`：

```ts
import type { Context } from './host-context.ts'

export class RouteError extends Error {
  constructor(readonly code: string, message: string, readonly status: number = 400) {
    super(message)
    this.name = 'RouteError'
  }
}

export async function resolveCwd(ctx: Context, sessionId: unknown): Promise<string> {
  if (typeof sessionId !== 'string' || sessionId.trim() === '') {
    throw new RouteError('bad-request', 'sessionId 必填')
  }
  const session = ctx.sessions.get(sessionId)
  if (session !== undefined) {
    const cwd = ctx.get('workingDirectory')?.get(session) ?? session.header.cwd
    if (cwd !== undefined && cwd !== '') return cwd
  }
  const stored = await ctx.get('sessionPersistence')?.stat?.(sessionId)
  const cwd = stored?.header.cwd
  if (cwd !== undefined && cwd !== '') return cwd
  throw new RouteError('unknown-session', `会话 "${sessionId}" 没有可解析的工作区`)
}
```

- [ ] **Step 5: 建 host 半并跑测试确认通过**

创建 `src/wire.ts`：

```ts
import { Buffer } from 'node:buffer'
import type { HttpRequest, HttpResponse } from './host-context.ts'
import { RouteError } from './session-cwd.ts'

const BODY_LIMIT = 1024 * 1024

export async function readJsonBody(req: HttpRequest): Promise<Record<string, unknown>> {
  const chunks: Uint8Array[] = []
  let size = 0
  for await (const chunk of req) {
    const bytes = typeof chunk === 'string' ? Buffer.from(chunk, 'utf8') : Buffer.from(chunk)
    size += bytes.byteLength
    if (size > BODY_LIMIT) throw new RouteError('too-large', '请求体超过 1 MiB', 413)
    chunks.push(bytes)
  }
  const text = Buffer.concat(chunks).toString('utf8')
  if (text.trim() === '') return {}
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new RouteError('bad-request', '请求体不是合法 JSON')
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new RouteError('bad-request', '请求体必须是 JSON 对象')
  }
  return parsed as Record<string, unknown>
}

export function writeJson(res: HttpResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': String(Buffer.byteLength(body)),
  })
  res.end(body)
}

export function writeOk(res: HttpResponse, value: unknown): void {
  writeJson(res, 200, { ok: true, value })
}

export function writeError(res: HttpResponse, error: unknown): void {
  if (error instanceof RouteError) {
    writeJson(res, error.status, { ok: false, error: { code: error.code, message: error.message } })
    return
  }
  const message = error instanceof Error ? error.message : String(error)
  writeJson(res, 500, { ok: false, error: { code: 'internal', message } })
}
```

创建 `src/state.ts`（本 Task 只做路径包含性 + 原子写；schema 校验在 Task 3 接上）：

```ts
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, resolve, sep } from 'node:path'
import { RouteError } from './session-cwd.ts'

export const STATE_RELATIVE = join('learning', 'framework.json')

export interface StateView {
  cwd: string
  path: string
  exists: boolean
  framework: unknown
}

export function resolveStatePath(cwd: string, relative: string): string {
  if (isAbsolute(relative) || relative.split(/[\\/]/).includes('..')) {
    throw new RouteError('bad-path', `状态路径必须是工作区内的相对路径："${relative}"`)
  }
  const root = resolve(cwd)
  const target = resolve(root, relative)
  if (target !== root && !target.startsWith(root + sep)) {
    throw new RouteError('outside-workspace', `路径 "${relative}" 越出了工作区`)
  }
  return target
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export async function readState(cwd: string): Promise<StateView> {
  const path = resolveStatePath(cwd, STATE_RELATIVE)
  let text: string
  try {
    text = await readFile(path, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { cwd, path, exists: false, framework: null }
    }
    throw new RouteError('read-failed', `读取 "${path}" 失败：${messageOf(error)}`, 500)
  }
  try {
    return { cwd, path, exists: true, framework: JSON.parse(text) }
  } catch {
    throw new RouteError('corrupt-state', `"${path}" 不是合法 JSON（可能上次写入被中断）；请修复或删除该文件后重试`, 409)
  }
}

export async function writeState(cwd: string, input: unknown): Promise<StateView> {
  const path = resolveStatePath(cwd, STATE_RELATIVE)
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new RouteError('bad-request', 'framework 必须是 JSON 对象')
  }
  await mkdir(dirname(path), { recursive: true })
  const temp = `${path}.${randomUUID().slice(0, 8)}.tmp`
  await writeFile(temp, `${JSON.stringify(input, null, 2)}\n`, 'utf8')
  try {
    await rename(temp, path)
  } catch (error) {
    await rm(temp, { force: true })
    throw new RouteError('write-failed', `写入 "${path}" 失败：${messageOf(error)}`, 500)
  }
  return { cwd, path, exists: true, framework: input }
}
```

创建 `src/index.ts`：

```ts
import type { Context } from './host-context.ts'
import { resolveCwd, RouteError } from './session-cwd.ts'
import { readState, writeState } from './state.ts'
import { readJsonBody, writeError, writeJson, writeOk } from './wire.ts'

export const name = 'dsh-skill-learning-coach'

export const inject = ['webServer', 'sessions', 'connection']

type Handler = (payload: Record<string, unknown>, ctx: Context) => Promise<unknown>

const api: Record<string, Handler> = {
  'state.read': async (payload, ctx) => readState(await resolveCwd(ctx, payload.sessionId)),
  'state.write': async (payload, ctx) => writeState(await resolveCwd(ctx, payload.sessionId), payload.framework),
}

export function apply(ctx: Context): void {
  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: '/learning-coach/api',
    handler: async (req, res) => {
      if (ctx.connection.requestRejection(req) !== undefined) {
        writeJson(res, 403, { ok: false, error: { code: 'forbidden', message: 'forbidden' } })
        return
      }
      if (req.method !== 'POST') {
        writeJson(res, 405, { ok: false, error: { code: 'method-error', message: 'method not allowed' } })
        return
      }
      const pathname = new URL(req.url ?? '/', 'http://dsh.internal').pathname
      const prefix = '/learning-coach/api/'
      const method = pathname.startsWith(prefix) ? pathname.slice(prefix.length) : undefined
      if (method === undefined || method.includes('/')) {
        writeError(res, new RouteError('not-found', '未知的 learning-coach 接口', 404))
        return
      }
      try {
        const payload = await readJsonBody(req)
        const handler = Object.hasOwn(api, method) ? api[method] : undefined
        if (typeof handler !== 'function') {
          throw new RouteError('not-found', `未知的 learning-coach 接口 "${method}"`, 404)
        }
        writeOk(res, await handler(payload, ctx))
      } catch (error) {
        writeError(res, error)
      }
    },
  }), 'dsh-skill-learning-coach: /learning-coach/api routes')
}
```

Run：`pnpm run build`
Expected: tsc 与 tsdown 都成功；此时还没有 client 入口，tsdown 会因缺 `src/client/index.ts` 失败——**这是预期的**，Step 6 补上后再跑。先单独验 host：`npx tsc -p tsconfig.json`，Expected: 无输出（成功），`lib/session-cwd.js` 存在。

Run：`node --test tests/session-cwd.test.mjs`
Expected: PASS，5 个测试全绿。

- [ ] **Step 6: 客户端探针卡**

创建 `src/client/css-modules.d.ts`：

```ts
declare module '*.module.css' {
  const classes: Record<string, string>
  export default classes
}
```

创建 `src/client/locales.ts`：

```ts
export const zh = {
  settingsTitle: '学习路线',
  workspace: '工作区',
  noWorkspace: '还没有带工作区的会话。先在 DSH 里打开一个项目再回来。',
  read: '读取状态',
  write: '写入探针',
  writing: '写入中…',
  result: 'host 返回',
  failed: '失败',
  hint: '这张卡此刻只验证通道：写入会在学习区落一个 learning/framework.json，主题是「通道验证」。确认路径对了以后，正式版会把它换成可编辑的路线框架。',
} as const

export const en: Record<keyof typeof zh, string> = {
  settingsTitle: 'Learning roadmap',
  workspace: 'Workspace',
  noWorkspace: 'No session with a workspace yet. Open a project in DSH first.',
  read: 'Read state',
  write: 'Write probe',
  writing: 'Writing…',
  result: 'Host response',
  failed: 'Failed',
  hint: 'This card only verifies the channel right now: writing drops a learning/framework.json into the workspace with topic "channel probe". Once the path is confirmed, the real card replaces it with an editable roadmap.',
}
```

创建 `src/client/context-types.ts`：

```ts
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-api-session-controller/client'
import type { zh } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'learning.coach': keyof typeof zh
  }
}

export type Context = ClientContext
```

创建 `src/client/api.ts`：

```ts
export class CoachApiError extends Error {
  constructor(readonly code: string, message: string) {
    super(message)
    this.name = 'CoachApiError'
  }
}

export interface StateView {
  cwd: string
  path: string
  exists: boolean
  framework: unknown
}

function routeUrl(method: string): string {
  const base = typeof document !== 'undefined' && document.baseURI !== '' ? document.baseURI : 'http://dsh.internal/'
  const url = new URL(base)
  url.search = ''
  url.hash = ''
  if (!url.pathname.endsWith('/')) url.pathname += '/'
  return new URL(`learning-coach/api/${method}`, url.href).href
}

async function call<T>(method: string, payload: Record<string, unknown>): Promise<T> {
  let response: Response
  try {
    response = await fetch(routeUrl(method), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch (error) {
    throw new CoachApiError('network', error instanceof Error ? error.message : String(error))
  }
  const parsed = await response.json().catch(() => null) as
    { ok?: boolean; value?: unknown; error?: { code?: string; message?: string } } | null
  if (!response.ok || parsed === null || parsed.ok !== true || parsed.value === undefined) {
    throw new CoachApiError(parsed?.error?.code ?? 'http', parsed?.error?.message ?? `HTTP ${response.status}`)
  }
  return parsed.value as T
}

export function readState(sessionId: string): Promise<StateView> {
  return call<StateView>('state.read', { sessionId })
}

export function saveState(sessionId: string, framework: unknown): Promise<StateView> {
  return call<StateView>('state.write', { sessionId, framework })
}
```

创建 `src/client/SettingsCard.tsx`（探针版，Task 4 整份替换）：

```tsx
import { useCallback, useMemo, useState, useSyncExternalStore } from 'react'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { Context } from './context-types.ts'
import { readState, saveState } from './api.ts'

export type SettingsCardProps = PropsLocale<'learning.coach'> & { ctx: Context }

const PROBE = {
  version: 1,
  topic: '通道验证',
  purpose: { kind: 'interest', detail: '', deadline: null },
  weeklyMinutes: 0,
  method: 'feynman',
  customMethod: null,
  current: null,
  nodes: [],
}

export function SettingsCard({ t, ctx }: SettingsCardProps): JSX.Element {
  const subscribe = useCallback((fn: () => void) => ctx.sessions.list.subscribe(fn), [ctx])
  const snapshot = useCallback(() => ctx.sessions.list.getSnapshot(), [ctx])
  const list = useSyncExternalStore(subscribe, snapshot)

  const options = useMemo(() => {
    const byCwd = new Map<string, { cwd: string; sessionId: string; updatedAt: number }>()
    for (const row of Object.values(list.byId)) {
      if (row.origin === 'subagent') continue
      const cwd = row.cwd
      if (cwd === undefined || cwd === '') continue
      const held = byCwd.get(cwd)
      if (held === undefined || row.updatedAt > held.updatedAt) {
        byCwd.set(cwd, { cwd, sessionId: row.id, updatedAt: row.updatedAt })
      }
    }
    return [...byCwd.values()].sort((a, b) => b.updatedAt - a.updatedAt)
  }, [list])

  const [picked, setPicked] = useState<string>('')
  const [busy, setBusy] = useState<boolean>(false)
  const [output, setOutput] = useState<string>('')
  const selected = options.find(option => option.cwd === picked) ?? options[0]

  const run = async (action: 'read' | 'write'): Promise<void> => {
    if (selected === undefined) return
    setBusy(true)
    try {
      const view = action === 'read'
        ? await readState(selected.sessionId)
        : await saveState(selected.sessionId, PROBE)
      setOutput(JSON.stringify(view, null, 2))
    } catch (error) {
      setOutput(`${t('failed')}: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setBusy(false)
    }
  }

  if (options.length === 0) return <p>{t('noWorkspace')}</p>

  return (
    <div>
      <p>{t('hint')}</p>
      <label>
        {t('workspace')}
        <select value={selected?.cwd ?? ''} onChange={event => setPicked(event.target.value)}>
          {options.map(option => <option key={option.cwd} value={option.cwd}>{option.cwd}</option>)}
        </select>
      </label>
      <div>
        <button type="button" disabled={busy} onClick={() => { void run('read') }}>{t('read')}</button>
        <button type="button" disabled={busy} onClick={() => { void run('write') }}>{busy ? t('writing') : t('write')}</button>
      </div>
      <pre>{output === '' ? t('result') : output}</pre>
    </div>
  )
}
```

创建 `src/client/index.ts`：

```ts
import type { Context } from './context-types.ts'
import { SettingsCard } from './SettingsCard.tsx'
import { en, zh } from './locales.ts'

export const name = 'dsh-skill-learning-coach-client'

export const inject = ['slots', 'locale', 'sessions']

export const LOCALE_NS = 'learning.coach'

export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register(LOCALE_NS, { zh, en }), 'dsh-skill-learning-coach: dictionaries')
  const t = ctx.locale.bind(LOCALE_NS)
  ctx.effect(() => ctx.slots.inject('settings.plugins.tab', () => ctx.slots.register({
    name: 'settings.plugins.tab',
    id: 'learning-coach',
    order: 30,
    label: () => t('settingsTitle'),
    locale: LOCALE_NS,
    inject: () => ({ ctx }),
  }, SettingsCard)), 'dsh-skill-learning-coach: settings tab')
}
```

- [ ] **Step 7: 全量构建 + 纯度门**

Run：`pnpm run build`
Expected: tsc 无错误，tsdown 产出 `lib/client.js`，首行是 `window.__ModuleLoader__.load({ id: "dsh-skill-learning-coach", factory: (require) => {`。

Run：`pnpm run test:client-bundle`
Expected: `client bundle import check passed (N module-table imports)`，N ≤ 7，无 forbidden 列表。

若 tsc 报 `ctx.sessions` / `ctx.locale` / `ctx.slots` 不存在：检查 `src/client/context-types.ts` 的六个 type-only import 是否齐全（声明合并靠它们），以及 `tsconfig.json` 的 `skipLibCheck` 是否为 true。

- [ ] **Step 8: 验 patch 能被 loader 解析（不装机、不动用户 profile）**

Run（包根，Git Bash）：

```bash
"F:/Program Files (x86)/deepseekharness/resources/runtime/cli/bin/dsh.cmd" \
  --profile web --dump-config \
  --patch "$(cygpath -w "$PWD/cordis.patch.yml")" > /tmp/lc-v2-dump.txt
grep -n "dsh-skill-learning-coach\|skill-learning-coach-bundled\|learning-coach-bundled" /tmp/lc-v2-dump.txt
```

Expected: 三个 id 都出现在 dump 里，且 `# == ...cordis.patch.yml` 分层标记存在。
注意：`--dump-config` **不会**求值 `!!js` 表达式（v1 已核实），所以这里只验"层被叠上、id 没写错"，表达式本身的正确性 v1 已用纯 Node 模拟验过，本 Task 不重复。
**不得**改用 `--profile desktop`（Electron 独占，CLI 会拒绝），**不得**新建验证 profile。

- [ ] **Step 9: 提交**

```bash
git -C F:/work/dsh-skill/dsh-skill-learning-coach add package.json pnpm-lock.yaml .gitignore cordis.patch.yml tsconfig.json tsdown.config.ts scripts src tests
git -C F:/work/dsh-skill/dsh-skill-learning-coach commit -m "feat: 打通设置卡到会话工作区的读写通道"
```

- [ ] **Step 10: 交给用户的真机检查点（agent 在此停下）**

把下面这段原样交给用户，然后**停**，等他回报。不要继续 Task 2。

> 包已做完通道验证版，构建与纯度门都过了。请你自己装一次：
>
> ```
> pnpm dsh plugin --profile desktop add link:F:/work/dsh-skill/dsh-skill-learning-coach
> ```
>
> 重启 DSH，打开任意一个项目会话，然后 设置 → 内置插件 → 学习路线。请回报三件事：
> 1. 下拉框里列出的工作区路径，是不是你当前会话的那个项目？
> 2. 点「写入探针」后，`<那个项目>/learning/framework.json` 是否出现，内容 topic 是否为「通道验证」？
> 3. **新开一个会话**（同一个项目），再点「读取状态」，是否读回同一份内容？
>
> 回滚命令：`pnpm dsh plugin --profile desktop remove dsh-skill-learning-coach`
> 探针文件可以直接删掉 `learning/` 目录，Task 4 的正式卡片会重新生成。

**通了** → 继续 Task 2。
**不通** → 按 spec §10 退路走，先停下问用户选哪条：
1. 状态存插件 config（`.volatile()` + **DSH 版 schemastery**，公开版静默失效），走 `settings.update` 落 profile patch，host 在会话开始时镜像到工作区；
2. AI 用 fs 工具自己维护 `framework.json`，设置卡降级为只读显示。
**不要自己猜着改**——退路会改变 Task 2–5 的接口，必须先让用户拍板。

---

### Task 2: 共用数据模型与校验器

**Files:**
- Create: `src/shared/framework.ts`
- Test: `tests/framework.test.mjs`

**Interfaces:**
- Consumes: 无（本模块**零 import**，host 与 client 共用；这是它能进浏览器 bundle 的前提）。
- Produces（后续 Task 全部按这些名字引用，不得改名）:
  - 常量：`PURPOSE_KINDS`、`NODE_STATUSES`、`METHOD_IDS`、`MATERIAL_KINDS`、`SPACED_INTERVALS`
  - 类型：`PurposeKind`、`NodeStatus`、`MethodId`、`MaterialKind`、`Material`、`FrameworkNode`、`Framework`、`WorkspaceOption`
  - `FrameworkError(code: string, message: string)`
  - `parseFramework(input: unknown): Framework`（非法即抛 `FrameworkError`）
  - `emptyFramework(topic: string): Framework`
  - `nodeOf(fw, id): FrameworkNode`
  - `replaceNode(fw, id, patch: Partial<Omit<FrameworkNode,'id'>>): Framework`
  - `nextChildId(fw, parent: string | null): string`
  - `addNode(fw, parent: string | null, title: string): Framework`
  - `removeSubtree(fw, id): Framework`
  - `pickCurrent(fw): string | null`
  - `appendMisconception(fw, id, text): Framework`
  - `assertAppendOnly(previous: Framework, next: Framework): void`
  - `nextReviewOn(from: string, doneCount: number): string | null`
  - `workspaceOptions(rows): WorkspaceOption[]`

- [ ] **Step 1: 写失败测试**

创建 `tests/framework.test.mjs`：

```js
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  addNode, appendMisconception, assertAppendOnly, emptyFramework, nextChildId,
  nextReviewOn, nodeOf, parseFramework, pickCurrent, removeSubtree, replaceNode,
  workspaceOptions,
} from '../lib/shared/framework.js'

function seeded() {
  let fw = emptyFramework('计算机网络')
  fw = addNode(fw, null, '物理层')
  fw = addNode(fw, null, '传输层')
  fw = addNode(fw, '2', 'TCP 三次握手')
  return fw
}

test('空框架能过校验并往返', () => {
  const fw = emptyFramework('计算机网络')
  assert.deepEqual(parseFramework(JSON.parse(JSON.stringify(fw))), fw)
})

test('编号层级与上级存在性', () => {
  const fw = seeded()
  assert.deepEqual(fw.nodes.map(n => n.id), ['1', '2', '2.1'])
  assert.equal(nextChildId(fw, '2'), '2.2')
  assert.equal(nextChildId(fw, null), '3')
  assert.equal(nodeOf(fw, '2.1').parent, '2')
})

test('上级不存在 / 编号重复 / 编号格式错都被拒', () => {
  const fw = seeded()
  const orphan = { ...fw, nodes: [...fw.nodes, { ...fw.nodes[2], id: '9.1', parent: '9' }] }
  assert.throws(() => parseFramework(orphan), err => err.code === 'orphan-node')
  const dup = { ...fw, nodes: [...fw.nodes, { ...fw.nodes[0] }] }
  assert.throws(() => parseFramework(dup), err => err.code === 'duplicate-id')
  const badId = { ...fw, nodes: [{ ...fw.nodes[0], id: 'a.b', parent: null }] }
  assert.throws(() => parseFramework(badId), err => err.code === 'bad-id')
})

test('job / exam 的 detail 不能空，interest 可以空', () => {
  const fw = emptyFramework('x')
  for (const kind of ['job', 'exam']) {
    assert.throws(() => parseFramework({ ...fw, purpose: { kind, detail: '  ', deadline: null } }), err => err.code === 'bad-purpose')
  }
  assert.equal(parseFramework({ ...fw, purpose: { kind: 'interest', detail: '', deadline: null } }).purpose.kind, 'interest')
})

test('custom 方法必须带描述，非 custom 必须为 null', () => {
  const fw = emptyFramework('x')
  assert.throws(() => parseFramework({ ...fw, method: 'custom', customMethod: null }), err => err.code === 'bad-method')
  assert.throws(() => parseFramework({ ...fw, method: 'feynman', customMethod: '自己的' }), err => err.code === 'bad-method')
  assert.equal(parseFramework({ ...fw, method: 'custom', customMethod: '自己的' }).customMethod, '自己的')
})

test('weeklyMinutes 与日期边界', () => {
  const fw = emptyFramework('x')
  assert.throws(() => parseFramework({ ...fw, weeklyMinutes: -1 }), err => err.code === 'bad-shape')
  assert.throws(() => parseFramework({ ...fw, weeklyMinutes: 10081 }), err => err.code === 'bad-shape')
  assert.throws(() => parseFramework({ ...fw, weeklyMinutes: 1.5 }), err => err.code === 'bad-shape')
  assert.throws(() => parseFramework({ ...fw, purpose: { kind: 'interest', detail: '', deadline: '2026/12/20' } }), err => err.code === 'bad-shape')
})

test('current 必须指向已有节点', () => {
  const fw = seeded()
  assert.throws(() => parseFramework({ ...fw, current: '7' }), err => err.code === 'bad-current')
  assert.equal(parseFramework({ ...fw, current: '2.1' }).current, '2.1')
})

test('pickCurrent 跳过 assumed-known 与 done，点选优先', () => {
  let fw = seeded()
  fw = replaceNode(fw, '1', { status: 'assumed-known' })
  assert.equal(pickCurrent(fw), '2')
  fw = replaceNode(fw, '2', { status: 'done' })
  assert.equal(pickCurrent(fw), '2.1')
  fw = replaceNode(fw, '2.1', { status: 'done' })
  assert.equal(pickCurrent(fw), null)
  assert.equal(pickCurrent({ ...fw, current: '1' }), '1')
})

test('removeSubtree 连子孙一起删并清掉失效 current', () => {
  let fw = seeded()
  fw = addNode(fw, '2.1', '为什么不是两次')
  fw = { ...fw, current: '2.1.1' }
  const after = removeSubtree(fw, '2')
  assert.deepEqual(after.nodes.map(n => n.id), ['1'])
  assert.equal(after.current, null)
})

test('卡壳只追加：重复不加、改写被拒、删节点不算改写', () => {
  let fw = seeded()
  fw = appendMisconception(fw, '2.1', '把确认收到当成唯一目的')
  fw = appendMisconception(fw, '2.1', '把确认收到当成唯一目的')
  assert.equal(nodeOf(fw, '2.1').misconceptions.length, 1)
  assertAppendOnly(fw, fw)
  const rewritten = replaceNode(fw, '2.1', { misconceptions: ['换个说法'] })
  assert.throws(() => assertAppendOnly(fw, rewritten), err => err.code === 'misconception-rewrite')
  const shrunk = replaceNode(fw, '2.1', { misconceptions: [] })
  assert.throws(() => assertAppendOnly(fw, shrunk), err => err.code === 'misconception-rewrite')
  assertAppendOnly(fw, removeSubtree(fw, '2.1'))
  assert.throws(() => appendMisconception(fw, '2.1', '   '), err => err.code === 'bad-misconception')
})

test('间隔重复表 +1/+3/+7/+14/+30，用尽返回 null', () => {
  assert.equal(nextReviewOn('2026-11-06', 0), '2026-11-07')
  assert.equal(nextReviewOn('2026-11-06', 1), '2026-11-09')
  assert.equal(nextReviewOn('2026-11-06', 2), '2026-11-13')
  assert.equal(nextReviewOn('2026-11-06', 3), '2026-11-20')
  assert.equal(nextReviewOn('2026-11-06', 4), '2026-12-06')
  assert.equal(nextReviewOn('2026-11-06', 5), null)
  assert.equal(nextReviewOn('2026-12-20', 4), '2027-01-19')
})

test('workspaceOptions 按 cwd 去重、取最新、排除 subagent、无 cwd 的行跳过', () => {
  const rows = [
    { id: 'a', cwd: '/p1', displayTitle: 'A', updatedAt: 10 },
    { id: 'b', cwd: '/p1', displayTitle: 'B', updatedAt: 30 },
    { id: 'c', cwd: '/p2', displayTitle: 'C', updatedAt: 20 },
    { id: 'd', cwd: '/p3', displayTitle: 'D', updatedAt: 99, origin: 'subagent' },
    { id: 'e', displayTitle: 'E', updatedAt: 100 },
    { id: 'f', cwd: '', displayTitle: 'F', updatedAt: 100 },
  ]
  assert.deepEqual(workspaceOptions(rows), [
    { cwd: '/p1', sessionId: 'b', updatedAt: 30 },
    { cwd: '/p2', sessionId: 'c', updatedAt: 20 },
  ])
})
```

- [ ] **Step 2: 跑测试确认它失败**

Run：`npx tsc -p tsconfig.json && node --test tests/framework.test.mjs`
Expected: FAIL — `Cannot find module .../lib/shared/framework.js`。

- [ ] **Step 3: 实现模型**

创建 `src/shared/framework.ts`：

```ts
export const PURPOSE_KINDS = ['job', 'exam', 'interest', 'career-switch'] as const
export type PurposeKind = (typeof PURPOSE_KINDS)[number]

export const NODE_STATUSES = ['pending', 'assumed-known', 'gap', 'drafted', 'done'] as const
export type NodeStatus = (typeof NODE_STATUSES)[number]

export const METHOD_IDS = ['feynman', 'recall', 'spaced', 'interleave', 'pomodoro', 'sq3r', 'cornell', 'custom'] as const
export type MethodId = (typeof METHOD_IDS)[number]

export const MATERIAL_KINDS = ['url', 'file', 'book'] as const
export type MaterialKind = (typeof MATERIAL_KINDS)[number]

export const SPACED_INTERVALS = [1, 3, 7, 14, 30] as const

export interface Material {
  kind: MaterialKind
  ref: string
  enough: string
}

export interface FrameworkNode {
  id: string
  parent: string | null
  title: string
  status: NodeStatus
  materials: Material[]
  mastery: string
  misconceptions: string[]
  reviewOn: string | null
  lecture: string | null
  minutesSpent: number
}

export interface Framework {
  version: 1
  topic: string
  purpose: { kind: PurposeKind; detail: string; deadline: string | null }
  weeklyMinutes: number
  method: MethodId
  customMethod: string | null
  current: string | null
  nodes: FrameworkNode[]
}

export interface WorkspaceOption {
  cwd: string
  sessionId: string
  updatedAt: number
}

export class FrameworkError extends Error {
  constructor(readonly code: string, message: string) {
    super(message)
    this.name = 'FrameworkError'
  }
}

const NODE_ID = /^[1-9][0-9]*(\.[1-9][0-9]*)*$/
const DATE = /^\d{4}-\d{2}-\d{2}$/

function fail(code: string, message: string): never {
  throw new FrameworkError(code, message)
}

function requireObject(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail('bad-shape', `${field} 必须是对象`)
  }
  return value as Record<string, unknown>
}

function requireArray(value: unknown, field: string): unknown[] {
  if (!Array.isArray(value)) fail('bad-shape', `${field} 必须是数组`)
  return value
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string') fail('bad-shape', `${field} 必须是字符串`)
  return value
}

function requireNonEmpty(value: unknown, field: string): string {
  const text = requireString(value, field)
  if (text.trim() === '') fail('bad-shape', `${field} 不能为空`)
  return text
}

function requireOneOf<T extends string>(value: unknown, allowed: readonly T[], field: string): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    fail('bad-shape', `${field} 必须是 ${allowed.join(' / ')} 之一`)
  }
  return value as T
}

function requireInt(value: unknown, field: string, max: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > max) {
    fail('bad-shape', `${field} 必须是 0–${max} 的整数`)
  }
  return value
}

function requireDateOrNull(value: unknown, field: string): string | null {
  if (value === null) return null
  const text = requireString(value, field)
  if (!DATE.test(text)) fail('bad-shape', `${field} 必须是 YYYY-MM-DD 或 null`)
  return text
}

function parseMaterial(input: unknown, field: string): Material {
  const row = requireObject(input, field)
  return {
    kind: requireOneOf(row.kind, MATERIAL_KINDS, `${field}.kind`),
    ref: requireNonEmpty(row.ref, `${field}.ref`),
    enough: requireString(row.enough, `${field}.enough`),
  }
}

function parseNode(input: unknown, field: string): FrameworkNode {
  const row = requireObject(input, field)
  const id = requireNonEmpty(row.id, `${field}.id`)
  if (!NODE_ID.test(id)) fail('bad-id', `${field}.id "${id}" 必须是 1 / 3.2 这样的层级编号`)
  const parent = row.parent === null ? null : requireNonEmpty(row.parent, `${field}.parent`)
  if (parent === null && id.includes('.')) {
    fail('bad-parent', `${field} 是顶级节点，编号不能带点`)
  }
  if (parent !== null && !id.startsWith(`${parent}.`)) {
    fail('bad-parent', `${field}.parent "${parent}" 必须是编号 "${id}" 的上级`)
  }
  return {
    id,
    parent,
    title: requireNonEmpty(row.title, `${field}.title`),
    status: requireOneOf(row.status, NODE_STATUSES, `${field}.status`),
    materials: requireArray(row.materials, `${field}.materials`).map((item, i) => parseMaterial(item, `${field}.materials[${i}]`)),
    mastery: requireString(row.mastery, `${field}.mastery`),
    misconceptions: requireArray(row.misconceptions, `${field}.misconceptions`).map((item, i) => requireNonEmpty(item, `${field}.misconceptions[${i}]`)),
    reviewOn: requireDateOrNull(row.reviewOn, `${field}.reviewOn`),
    lecture: row.lecture === null ? null : requireNonEmpty(row.lecture, `${field}.lecture`),
    minutesSpent: requireInt(row.minutesSpent, `${field}.minutesSpent`, 100000),
  }
}

export function parseFramework(input: unknown): Framework {
  const row = requireObject(input, 'framework')
  if (row.version !== 1) fail('bad-version', `framework.version 必须是 1，收到 ${JSON.stringify(row.version)}`)
  const purpose = requireObject(row.purpose, 'purpose')
  const kind = requireOneOf(purpose.kind, PURPOSE_KINDS, 'purpose.kind')
  const detail = requireString(purpose.detail, 'purpose.detail')
  if ((kind === 'job' || kind === 'exam') && detail.trim() === '') {
    fail('bad-purpose', kind === 'job' ? 'purpose.detail 必须写清目标岗位' : 'purpose.detail 必须写清考试名')
  }
  const method = requireOneOf(row.method, METHOD_IDS, 'method')
  const customMethod = row.customMethod === null ? null : requireNonEmpty(row.customMethod, 'customMethod')
  if (method === 'custom' && customMethod === null) fail('bad-method', '选自定义方法时 customMethod 不能为空')
  if (method !== 'custom' && customMethod !== null) fail('bad-method', '只有选自定义方法时才有 customMethod')
  const nodes = requireArray(row.nodes, 'nodes').map((item, i) => parseNode(item, `nodes[${i}]`))
  const ids = new Set<string>()
  for (const node of nodes) {
    if (ids.has(node.id)) fail('duplicate-id', `节点编号 "${node.id}" 重复`)
    ids.add(node.id)
  }
  for (const node of nodes) {
    if (node.parent !== null && !ids.has(node.parent)) {
      fail('orphan-node', `节点 "${node.id}" 的上级 "${node.parent}" 不存在`)
    }
  }
  const current = row.current === null ? null : requireNonEmpty(row.current, 'current')
  if (current !== null && !ids.has(current)) fail('bad-current', `current "${current}" 不是已有节点`)
  return {
    version: 1,
    topic: requireNonEmpty(row.topic, 'topic'),
    purpose: { kind, detail, deadline: requireDateOrNull(purpose.deadline, 'purpose.deadline') },
    weeklyMinutes: requireInt(row.weeklyMinutes, 'weeklyMinutes', 10080),
    method,
    customMethod,
    current,
    nodes,
  }
}

export function emptyFramework(topic: string): Framework {
  return {
    version: 1,
    topic,
    purpose: { kind: 'interest', detail: '', deadline: null },
    weeklyMinutes: 0,
    method: 'feynman',
    customMethod: null,
    current: null,
    nodes: [],
  }
}

export function nodeOf(fw: Framework, id: string): FrameworkNode {
  const node = fw.nodes.find(item => item.id === id)
  if (node === undefined) fail('unknown-node', `节点 "${id}" 不存在`)
  return node
}

export function replaceNode(fw: Framework, id: string, patch: Partial<Omit<FrameworkNode, 'id'>>): Framework {
  nodeOf(fw, id)
  return { ...fw, nodes: fw.nodes.map(node => (node.id === id ? { ...node, ...patch, id: node.id } : node)) }
}

export function nextChildId(fw: Framework, parent: string | null): string {
  const prefix = parent === null ? '' : `${parent}.`
  let max = 0
  for (const node of fw.nodes) {
    if (node.parent !== parent) continue
    const value = Number(node.id.slice(prefix.length))
    if (Number.isInteger(value) && value > max) max = value
  }
  return `${prefix}${max + 1}`
}

export function addNode(fw: Framework, parent: string | null, title: string): Framework {
  if (parent !== null) nodeOf(fw, parent)
  const node: FrameworkNode = {
    id: nextChildId(fw, parent),
    parent,
    title,
    status: 'pending',
    materials: [],
    mastery: '',
    misconceptions: [],
    reviewOn: null,
    lecture: null,
    minutesSpent: 0,
  }
  const nodes = [...fw.nodes]
  if (parent === null) {
    nodes.push(node)
  } else {
    let at = nodes.findIndex(item => item.id === parent) + 1
    while (at < nodes.length && nodes[at]!.id.startsWith(`${parent}.`)) at += 1
    nodes.splice(at, 0, node)
  }
  return { ...fw, nodes }
}

export function removeSubtree(fw: Framework, id: string): Framework {
  nodeOf(fw, id)
  const nodes = fw.nodes.filter(node => node.id !== id && !node.id.startsWith(`${id}.`))
  const lost = fw.current !== null && (fw.current === id || fw.current.startsWith(`${id}.`))
  return { ...fw, nodes, current: lost ? null : fw.current }
}

export function pickCurrent(fw: Framework): string | null {
  if (fw.current !== null) return fw.current
  return fw.nodes.find(node => node.status !== 'assumed-known' && node.status !== 'done')?.id ?? null
}

export function appendMisconception(fw: Framework, id: string, text: string): Framework {
  const node = nodeOf(fw, id)
  const entry = text.trim()
  if (entry === '') fail('bad-misconception', '卡壳记录不能为空')
  if (node.misconceptions.includes(entry)) return fw
  return replaceNode(fw, id, { misconceptions: [...node.misconceptions, entry] })
}

export function assertAppendOnly(previous: Framework, next: Framework): void {
  for (const old of previous.nodes) {
    const now = next.nodes.find(node => node.id === old.id)
    if (now === undefined) continue
    if (!old.misconceptions.every((entry, i) => now.misconceptions[i] === entry)) {
      fail('misconception-rewrite', `节点 "${old.id}" 的卡壳档案只能追加，不能改写或删除`)
    }
  }
}

export function nextReviewOn(from: string, doneCount: number): string | null {
  const days = SPACED_INTERVALS[doneCount]
  if (days === undefined) return null
  const base = new Date(`${from}T00:00:00Z`)
  if (Number.isNaN(base.getTime())) fail('bad-date', `日期 "${from}" 非法`)
  base.setUTCDate(base.getUTCDate() + days)
  return base.toISOString().slice(0, 10)
}

export function workspaceOptions(rows: readonly {
  id: string
  cwd?: string
  displayTitle: string
  updatedAt: number
  origin?: string
}[]): WorkspaceOption[] {
  const byCwd = new Map<string, WorkspaceOption>()
  for (const row of rows) {
    if (row.origin === 'subagent') continue
    const cwd = row.cwd
    if (cwd === undefined || cwd === '') continue
    const held = byCwd.get(cwd)
    if (held === undefined || row.updatedAt > held.updatedAt) {
      byCwd.set(cwd, { cwd, sessionId: row.id, updatedAt: row.updatedAt })
    }
  }
  return [...byCwd.values()].sort((a, b) => b.updatedAt - a.updatedAt)
}
```

- [ ] **Step 4: 跑测试确认通过**

Run：`npx tsc -p tsconfig.json && node --test tests/framework.test.mjs`
Expected: PASS，12 个测试全绿。

若 `requireString` 之后 TS 仍把 value 当 unknown：确认 `fail` 的返回类型写的是 `never`（不是 `void`），且是函数声明而非箭头常量——TS 的控制流收窄只认显式 `never` 返回的具名函数。

- [ ] **Step 5: 提交**

```bash
git -C F:/work/dsh-skill/dsh-skill-learning-coach add src/shared/framework.ts tests/framework.test.mjs
git -C F:/work/dsh-skill/dsh-skill-learning-coach commit -m "feat: 路线框架的共用模型、校验器与纯变更助手"
```

---

### Task 3: 把校验与"卡壳只追加"接进 host 落盘

**Files:**
- Modify: `src/state.ts`、`src/client/api.ts`（`StateView.framework` 收紧类型）
- Test: `tests/state.test.mjs`

**Interfaces:**
- Consumes: Task 2 的 `parseFramework`、`assertAppendOnly`、`Framework`、`FrameworkError`；Task 1 的 `resolveStatePath`、`RouteError`、`StateView`。
- Produces: `readState(cwd): Promise<StateView>` 与 `writeState(cwd, input: unknown): Promise<StateView>`，其中 `StateView.framework: Framework | null`；新增错误码 `invalid-state`（读 409 / 写 400）、`misconception-rewrite`（409）。`STATE_RELATIVE` 不变。

- [ ] **Step 1: 写失败测试**

创建 `tests/state.test.mjs`：

```js
import assert from 'node:assert/strict'
import { mkdtemp, readFile, readdir, rm, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { readState, resolveStatePath, writeState, STATE_RELATIVE } from '../lib/state.js'
import { addNode, appendMisconception, emptyFramework } from '../lib/shared/framework.js'

async function workspace(t) {
  const dir = await mkdtemp(join(tmpdir(), 'lc-state-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  return dir
}

test('路径包含性：拒绝绝对路径与 ..', () => {
  assert.throws(() => resolveStatePath('/ws', '../evil.json'), err => err.code === 'bad-path')
  assert.throws(() => resolveStatePath('/ws', 'learning/../../evil.json'), err => err.code === 'bad-path')
  assert.throws(() => resolveStatePath('/ws', '/etc/evil.json'), err => err.code === 'bad-path')
  assert.throws(() => resolveStatePath('C:/ws', 'C:/evil.json'), err => err.code === 'bad-path')
  assert.equal(resolveStatePath('/ws', STATE_RELATIVE), join('/ws', 'learning', 'framework.json'))
})

test('没有文件时 exists=false、framework=null，不算错误', async t => {
  const dir = await workspace(t)
  const view = await readState(dir)
  assert.equal(view.exists, false)
  assert.equal(view.framework, null)
  assert.equal(view.cwd, dir)
})

test('半截 JSON 报明确错误，不静默兜底', async t => {
  const dir = await workspace(t)
  await mkdir(join(dir, 'learning'), { recursive: true })
  await writeFile(join(dir, 'learning', 'framework.json'), '{"version": 1, "top', 'utf8')
  await assert.rejects(() => readState(dir), err => err.code === 'corrupt-state' && err.status === 409)
})

test('合法 JSON 但不合框架同样报明确错误', async t => {
  const dir = await workspace(t)
  await mkdir(join(dir, 'learning'), { recursive: true })
  await writeFile(join(dir, 'learning', 'framework.json'), '{"version": 2}', 'utf8')
  await assert.rejects(() => readState(dir), err => err.code === 'invalid-state' && err.status === 409)
})

test('写入非法框架被拒且不落盘', async t => {
  const dir = await workspace(t)
  await assert.rejects(() => writeState(dir, { version: 1 }), err => err.code === 'invalid-state' && err.status === 400)
  assert.equal((await readState(dir)).exists, false)
})

test('写入合法框架后能读回，且目录里没有残留 tmp', async t => {
  const dir = await workspace(t)
  const fw = addNode(emptyFramework('计算机网络'), null, '传输层')
  const view = await writeState(dir, fw)
  assert.equal(view.exists, true)
  assert.deepEqual(view.framework, fw)
  assert.deepEqual(await readState(dir), view)
  const entries = await readdir(join(dir, 'learning'))
  assert.deepEqual(entries, ['framework.json'])
  const text = await readFile(join(dir, 'learning', 'framework.json'), 'utf8')
  assert.ok(text.endsWith('\n'))
})

test('卡壳档案被改写时拒绝写入，磁盘保持原样', async t => {
  const dir = await workspace(t)
  let fw = addNode(emptyFramework('x'), null, '传输层')
  fw = appendMisconception(fw, '1', '原始卡壳')
  await writeState(dir, fw)
  const tampered = { ...fw, nodes: [{ ...fw.nodes[0], misconceptions: ['被改掉'] }] }
  await assert.rejects(() => writeState(dir, tampered), err => err.code === 'misconception-rewrite' && err.status === 409)
  assert.deepEqual((await readState(dir)).framework.nodes[0].misconceptions, ['原始卡壳'])
})

test('追加卡壳允许写入', async t => {
  const dir = await workspace(t)
  let fw = addNode(emptyFramework('x'), null, '传输层')
  fw = appendMisconception(fw, '1', '原始卡壳')
  await writeState(dir, fw)
  const more = appendMisconception(fw, '1', '第二个卡壳')
  await writeState(dir, more)
  assert.deepEqual((await readState(dir)).framework.nodes[0].misconceptions, ['原始卡壳', '第二个卡壳'])
})
```

- [ ] **Step 2: 跑测试确认它失败**

Run：`npx tsc -p tsconfig.json && node --test tests/state.test.mjs`
Expected: FAIL — `invalid-state` / `misconception-rewrite` 相关的 4 个测试失败（Task 1 的 state.ts 还没有校验），其余通过。记下具体哪几个失败。

- [ ] **Step 3: 接上校验**

修改 `src/state.ts`。把 import 段改成：

```ts
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, resolve, sep } from 'node:path'
import { RouteError } from './session-cwd.ts'
import { assertAppendOnly, parseFramework, type Framework } from './shared/framework.ts'
```

把 `StateView` 改成：

```ts
export interface StateView {
  cwd: string
  path: string
  exists: boolean
  framework: Framework | null
}
```

把 `readState` 的第二个 try 块（`return { cwd, path, exists: true, framework: JSON.parse(text) }` 那一段）改成：

```ts
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new RouteError('corrupt-state', `"${path}" 不是合法 JSON（可能上次写入被中断）；请修复或删除该文件后重试`, 409)
  }
  try {
    return { cwd, path, exists: true, framework: parseFramework(parsed) }
  } catch (error) {
    throw new RouteError('invalid-state', `"${path}" 内容不合框架：${messageOf(error)}`, 409)
  }
```

把 `writeState` 开头到 `await mkdir` 之前的部分改成：

```ts
export async function writeState(cwd: string, input: unknown): Promise<StateView> {
  const path = resolveStatePath(cwd, STATE_RELATIVE)
  let framework: Framework
  try {
    framework = parseFramework(input)
  } catch (error) {
    throw new RouteError('invalid-state', messageOf(error), 400)
  }
  const previous = await readState(cwd)
  if (previous.framework !== null) {
    try {
      assertAppendOnly(previous.framework, framework)
    } catch (error) {
      throw new RouteError('misconception-rewrite', messageOf(error), 409)
    }
  }
  await mkdir(dirname(path), { recursive: true })
```

并把 `writeState` 末尾的落盘与返回改成用校验后的 `framework`（而不是原始 `input`）：

```ts
  const temp = `${path}.${randomUUID().slice(0, 8)}.tmp`
  await writeFile(temp, `${JSON.stringify(framework, null, 2)}\n`, 'utf8')
  try {
    await rename(temp, path)
  } catch (error) {
    await rm(temp, { force: true })
    throw new RouteError('write-failed', `写入 "${path}" 失败：${messageOf(error)}`, 500)
  }
  return { cwd, path, exists: true, framework }
}
```

修改 `src/client/api.ts`：在文件顶部加一行 type-only import，并把 `StateView.framework` 收紧。

```ts
import type { Framework } from '../shared/framework.ts'
```

```ts
export interface StateView {
  cwd: string
  path: string
  exists: boolean
  framework: Framework | null
}
```

并把 `saveState` 的签名改成：

```ts
export function saveState(sessionId: string, framework: Framework): Promise<StateView> {
  return call<StateView>('state.write', { sessionId, framework })
}
```

- [ ] **Step 4: 修 Task 1 探针卡与新类型的冲突**

`src/client/SettingsCard.tsx` 里的 `PROBE` 常量现在必须满足 `Framework`。把它改成用共用模型构造（同时这是 client 第一次引用 shared，验证纯度门不会炸）：

顶部 import 段追加：

```ts
import { emptyFramework } from '../shared/framework.ts'
```

把 `const PROBE = {...}` 整块替换成：

```ts
const PROBE = emptyFramework('通道验证')
```

- [ ] **Step 5: 跑全部测试与构建**

Run：`pnpm run test`
Expected: PASS — `tests/session-cwd.test.mjs` 5 个 + `tests/framework.test.mjs` 12 个 + `tests/state.test.mjs` 8 个，共 25 个全绿。

Run：`pnpm run test:client-bundle`
Expected: 通过，forbidden 列表为空（`shared/framework.ts` 零 import，被内联进 bundle，不产生新 require）。

- [ ] **Step 6: 提交**

```bash
git -C F:/work/dsh-skill/dsh-skill-learning-coach add src/state.ts src/client/api.ts src/client/SettingsCard.tsx tests/state.test.mjs
git -C F:/work/dsh-skill/dsh-skill-learning-coach commit -m "feat: 落盘前校验框架并守住卡壳档案只追加"
```

---

### Task 4: 设置卡——工作区、目的、时间、8 张方法卡

**Files:**
- Modify: `src/client/SettingsCard.tsx`（整份替换探针版）、`src/client/locales.ts`（整份替换）、`src/client/index.ts`（注册目标 `settings.plugins.tab` → `settings.section`，删旧注册）
- Create: `src/client/SettingsCard.module.css`、`tests/settings-entry.test.mjs`

**Interfaces:**
- Consumes: Task 1 的 `readState` / `saveState` / `Context`；Task 2 的 `METHOD_IDS` / `PURPOSE_KINDS` / `emptyFramework` / `parseFramework` / `pickCurrent` / `workspaceOptions` 与类型 `Framework` / `MethodId` / `PurposeKind` / `NodeStatus`。
- Produces: `SettingsCardProps = PropsLocale<'learning.coach'> & { ctx: Context; close: () => void }`（`close` 是 `settings.section` 的 owner 注入，spec §13）；locale 命名空间 `learning.coach` 的完整字典（Task 5 直接用其中 `node*` / `material*` / `mastery*` 等键，不再新增键）；CSS 类名 `card / field / label / input / hint / error / button / section / tree / node / nodeCurrent / nodeId / nodeTitle / badge / methods / method / methodOn / methodName / methodDesc`（Task 5 追加 `nodeActions / nodeBody / material / mislist`）。

**设计决定（实施者照此做，不要自行加 Save 按钮）：**
- 入口迁移（spec §13）：注册目标改为 `settings.section`，`id: 'learning-coach'` / `order: 30` / `label: () => t('settingsTitle')`；删除 plugins.tab 注册，只留一个入口。`SettingsCardProps` 增加 owner 注入的 `close`，空态的"去开会话"按钮调用它。**先让卡片接住 `close`（Step 4）再迁入口（Step 5）**——反序会让 tsc 报组件类型不匹配。
- 离散操作（下拉、方法卡、按钮）**改动即写盘**；文本/数字/日期输入**失焦即写盘**（`TextField` 内部持有局部文本，`onBlur` 才 commit），避免每敲一个字就发一次请求。
- `commit` 先用 `parseFramework` 本地校验，不合法就只显示错误、不发请求。这样"点自定义但还没填描述"不会往磁盘写非法状态。
- 写盘失败时**保留用户的 draft**并显示错误 + 重试按钮，不静默回滚（回滚会吞掉用户刚打的字）。
- 不用 localStorage，真源只有磁盘。

- [ ] **Step 1: 写完整字典**

整份替换 `src/client/locales.ts`：

```ts
export const zh = {
  settingsTitle: '学习路线',
  workspace: '工作区',
  noWorkspace: '还没有带工作区的会话。先在 DSH 里打开一个项目，再回来看这张卡。',
  loading: '正在读取…',
  loadFailed: '读取失败',
  saveFailed: '保存失败',
  retry: '重试',
  path: '状态文件',
  emptyHint: '这个工作区还没有路线框架。在会话里说「我想学 X」，AI 会问清目的再生成；也可以先在这里建一个空的自己填。',
  createEmpty: '建一个空框架',
  goToSession: '去开会话',
  defaultTopic: '我的学习主题',
  topic: '学什么',
  purpose: '为什么学',
  purposeJob: '为了工作',
  purposeExam: '为了考试',
  purposeInterest: '兴趣',
  purposeCareerSwitch: '转行',
  purposeDetail: '具体目标',
  purposeDetailJob: '写清目标岗位，例如「后端求职面试」。岗位决定达标动作长什么样。',
  purposeDetailExam: '写清考试名，例如「408 统考」。考试决定达标动作是限时答对真题。',
  deadline: '期限',
  weeklyMinutes: '每周真能投入的分钟数',
  weeklyMinutesHint: '按过去一周实际花的时间填，不按理想计划。0–10080。',
  framework: '路线框架',
  nodeCount: '节点数',
  currentNode: '当前节',
  none: '无',
  nodeTitle: '节点标题',
  addRoot: '加一个顶级节点',
  addChild: '加子节',
  remove: '删除',
  confirmRemove: '再点一次确认删除（连子节一起）',
  select: '从这开始学',
  markGap: '标没懂',
  materials: '资料',
  materialKind: '类型',
  kindUrl: '链接',
  kindFile: '本地文件',
  kindBook: '书 / 章节',
  materialRef: '地址或书名',
  materialEnough: '读到什么程度算够',
  addMaterial: '加一份资料',
  removeMaterial: '删掉这份',
  mastery: '达标标准（一件可验证的动作）',
  masteryHint: '禁止「读完某章」「理解某概念」。要写成做出来的事，例如「不看资料画出三段报文交换图」。',
  misconceptions: '卡壳档案（只追加，AI 下次会话会引用）',
  method: '学习方法',
  methodFeynman: '费曼技巧',
  methodFeynmanDesc: '讲给新人听 → 找卡壳 → 简化重讲',
  methodRecall: '主动回忆',
  methodRecallDesc: '合上资料先答，再对照补漏',
  methodSpaced: '间隔重复',
  methodSpacedDesc: '按遗忘曲线排复习日（+1/+3/+7/+14/+30）',
  methodInterleave: '交错练习',
  methodInterleaveDesc: '相邻主题混着练，不刷同一类题',
  methodPomodoro: '番茄钟 + 刻意练习',
  methodPomodoroDesc: '25 分钟一块，只练最弱那一点',
  methodSq3r: 'SQ3R 精读',
  methodSq3rDesc: '浏览-提问-读-复述-复习，啃官方文档',
  methodCornell: '康奈尔笔记',
  methodCornellDesc: '线索栏 / 笔记栏 / 总结栏',
  methodCustom: '自定义',
  methodCustomDesc: '填你自己的方法，AI 按它执行',
  customMethod: '你的方法怎么做',
  customMethodHint: '写清步骤，AI 会照着带练。填完失焦才算选定。',
  statusPending: '还没问',
  statusAssumedKnown: '默认已懂',
  statusGap: '没懂',
  statusDrafted: '已出讲义',
  statusDone: '已达标',
} as const

export const en: Record<keyof typeof zh, string> = {
  settingsTitle: 'Learning roadmap',
  workspace: 'Workspace',
  noWorkspace: 'No session with a workspace yet. Open a project in DSH, then come back.',
  loading: 'Loading…',
  loadFailed: 'Read failed',
  saveFailed: 'Save failed',
  retry: 'Retry',
  path: 'State file',
  emptyHint: 'No roadmap in this workspace yet. Say "I want to learn X" in a session and the coach will ask your purpose first, then generate one. Or create an empty one here.',
  createEmpty: 'Create empty roadmap',
  goToSession: 'Open a session',
  defaultTopic: 'My topic',
  topic: 'Topic',
  purpose: 'Purpose',
  purposeJob: 'For a job',
  purposeExam: 'For an exam',
  purposeInterest: 'Interest',
  purposeCareerSwitch: 'Career switch',
  purposeDetail: 'Concrete target',
  purposeDetailJob: 'Name the target role, e.g. "backend interview". The role shapes what mastery looks like.',
  purposeDetailExam: 'Name the exam, e.g. "408 national exam". The exam makes mastery a timed past-paper answer.',
  deadline: 'Deadline',
  weeklyMinutes: 'Minutes you can really invest per week',
  weeklyMinutesHint: 'Use what you actually spent last week, not an ideal plan. 0–10080.',
  framework: 'Roadmap',
  nodeCount: 'Nodes',
  currentNode: 'Current',
  none: 'none',
  nodeTitle: 'Node title',
  addRoot: 'Add top-level node',
  addChild: 'Add child',
  remove: 'Delete',
  confirmRemove: 'Click again to delete (with children)',
  select: 'Start here',
  markGap: 'Mark as gap',
  materials: 'Materials',
  materialKind: 'Kind',
  kindUrl: 'URL',
  kindFile: 'Local file',
  kindBook: 'Book / chapter',
  materialRef: 'Address or title',
  materialEnough: 'How far is enough',
  addMaterial: 'Add material',
  removeMaterial: 'Remove',
  mastery: 'Mastery (one verifiable action)',
  masteryHint: 'Not "finish chapter 3" or "understand X". Write something you DO, e.g. "draw the three-way handshake from memory".',
  misconceptions: 'Gap log (append-only; the coach cites it next session)',
  method: 'Learning method',
  methodFeynman: 'Feynman',
  methodFeynmanDesc: 'Teach a newcomer → find the gap → simplify and reteach',
  methodRecall: 'Active recall',
  methodRecallDesc: 'Close the material, answer first, then check',
  methodSpaced: 'Spaced repetition',
  methodSpacedDesc: 'Review dates on the forgetting curve (+1/+3/+7/+14/+30)',
  methodInterleave: 'Interleaving',
  methodInterleaveDesc: 'Mix neighbouring topics instead of drilling one kind',
  methodPomodoro: 'Pomodoro + deliberate practice',
  methodPomodoroDesc: '25-minute blocks spent only on the weakest point',
  methodSq3r: 'SQ3R',
  methodSq3rDesc: 'Survey-Question-Read-Recite-Review for official docs',
  methodCornell: 'Cornell notes',
  methodCornellDesc: 'Cue column / note column / summary',
  methodCustom: 'Custom',
  methodCustomDesc: 'Describe your own method; the coach follows it',
  customMethod: 'How your method works',
  customMethodHint: 'Write the steps. Blur the field to confirm the choice.',
  statusPending: 'Not asked',
  statusAssumedKnown: 'Assumed known',
  statusGap: 'Gap',
  statusDrafted: 'Lecture drafted',
  statusDone: 'Mastered',
}
```

- [ ] **Step 2: 写样式**

创建 `src/client/SettingsCard.module.css`（主题变量名照 dsh-voice-announcer：`--divider-color` / `--accent-color`，都带兜底值）：

```css
.card {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 4px 2px 16px;
}

.section {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px 16px;
  border: 1px solid var(--divider-color, rgba(128, 128, 128, 0.25));
  border-radius: 10px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.label {
  font-size: 13px;
  font-weight: 500;
}

.input {
  padding: 6px 8px;
  border: 1px solid var(--divider-color, rgba(128, 128, 128, 0.35));
  border-radius: 6px;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 13px;
}

.hint {
  font-size: 12px;
  opacity: 0.65;
  margin: 0;
}

.error {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 12px;
  color: var(--error-color, #d64545);
}

.button {
  align-self: flex-start;
  padding: 5px 10px;
  border: 1px solid var(--divider-color, rgba(128, 128, 128, 0.35));
  border-radius: 6px;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}

.tree {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.node,
.nodeCurrent {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  font-size: 13px;
}

.nodeCurrent {
  border: 1px solid var(--accent-color, rgba(80, 140, 255, 0.5));
}

.nodeId {
  flex-shrink: 0;
  opacity: 0.6;
  font-variant-numeric: tabular-nums;
}

.nodeTitle {
  flex: 1;
  min-width: 0;
}

.badge {
  flex-shrink: 0;
  padding: 1px 6px;
  border: 1px solid var(--divider-color, rgba(128, 128, 128, 0.35));
  border-radius: 999px;
  font-size: 11px;
  opacity: 0.8;
}

.methods {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 8px;
}

.method,
.methodOn {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  border: 1px solid var(--divider-color, rgba(128, 128, 128, 0.25));
  border-radius: 8px;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.methodOn {
  border-color: var(--accent-color, rgba(80, 140, 255, 0.5));
}

.methodName {
  font-size: 13px;
  font-weight: 600;
}

.methodDesc {
  font-size: 11px;
  opacity: 0.65;
}

.nodeActions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.nodeBody {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px 8px 4px;
}

.material {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  border: 1px solid var(--divider-color, rgba(128, 128, 128, 0.2));
  border-radius: 6px;
}

.mislist {
  margin: 0;
  padding-left: 18px;
  font-size: 12px;
  opacity: 0.8;
}
```

- [ ] **Step 3: 写入口静态测试（先红）**

创建 `tests/settings-entry.test.mjs`（静态断言锁住 spec §13 的入口迁移，防回归）：

```js
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

const source = await readFile(new URL('../src/client/index.ts', import.meta.url), 'utf8')

test('客户端入口注册 settings.section 一级设置页面', () => {
  assert.match(source, /slots\.inject\('settings\.section'/)
  assert.match(source, /name: 'settings\.section'/)
  assert.match(source, /id: 'learning-coach'/)
  assert.match(source, /order: 30/)
})

test('不再注册 settings.plugins.tab（内置插件页内无同名 tab）', () => {
  assert.doesNotMatch(source, /settings\.plugins\.tab/)
})
```

Run：`node --test tests/settings-entry.test.mjs`
Expected: FAIL——Task 1 的 `src/client/index.ts` 还注册着 `settings.plugins.tab`，两条都红。记下失败信息。

- [ ] **Step 4: 整份替换设置卡**

整份替换 `src/client/SettingsCard.tsx`（相对本 Task 初版全文的两处变化已写进下面：props 增加 owner 注入的 `close`；空态加"去开会话"按钮）：

```tsx
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { Context } from './context-types.ts'
import { readState, saveState } from './api.ts'
import {
  METHOD_IDS,
  PURPOSE_KINDS,
  emptyFramework,
  parseFramework,
  pickCurrent,
  workspaceOptions,
  type Framework,
  type MethodId,
  type NodeStatus,
  type PurposeKind,
} from '../shared/framework.ts'
import type { zh } from './locales.ts'
import css from './SettingsCard.module.css'

export type SettingsCardProps = PropsLocale<'learning.coach'> & { ctx: Context; close: () => void }

type LocaleKey = keyof typeof zh

const PURPOSE_LABEL: Record<PurposeKind, LocaleKey> = {
  job: 'purposeJob',
  exam: 'purposeExam',
  interest: 'purposeInterest',
  'career-switch': 'purposeCareerSwitch',
}

const METHOD_LABEL: Record<MethodId, LocaleKey> = {
  feynman: 'methodFeynman',
  recall: 'methodRecall',
  spaced: 'methodSpaced',
  interleave: 'methodInterleave',
  pomodoro: 'methodPomodoro',
  sq3r: 'methodSq3r',
  cornell: 'methodCornell',
  custom: 'methodCustom',
}

const METHOD_DESC: Record<MethodId, LocaleKey> = {
  feynman: 'methodFeynmanDesc',
  recall: 'methodRecallDesc',
  spaced: 'methodSpacedDesc',
  interleave: 'methodInterleaveDesc',
  pomodoro: 'methodPomodoroDesc',
  sq3r: 'methodSq3rDesc',
  cornell: 'methodCornellDesc',
  custom: 'methodCustomDesc',
}

const STATUS_LABEL: Record<NodeStatus, LocaleKey> = {
  pending: 'statusPending',
  'assumed-known': 'statusAssumedKnown',
  gap: 'statusGap',
  drafted: 'statusDrafted',
  done: 'statusDone',
}

interface TextFieldProps {
  label: string
  value: string
  hint?: string
  type?: 'text' | 'date' | 'number'
  onCommit: (next: string) => void
}

function TextField({ label, value, hint, type = 'text', onCommit }: TextFieldProps): JSX.Element {
  const [text, setText] = useState<string>(value)
  useEffect(() => { setText(value) }, [value])
  return (
    <label className={css.field}>
      <span className={css.label}>{label}</span>
      <input
        className={css.input}
        type={type}
        value={text}
        onChange={event => setText(event.target.value)}
        onBlur={() => { if (text !== value) onCommit(text) }}
      />
      {hint === undefined ? null : <span className={css.hint}>{hint}</span>}
    </label>
  )
}

interface LoadState {
  status: 'loading' | 'ready' | 'error'
  path: string
  error: string
}

export function SettingsCard({ t, ctx, close }: SettingsCardProps): JSX.Element {
  const subscribe = useCallback((fn: () => void) => ctx.sessions.list.subscribe(fn), [ctx])
  const snapshot = useCallback(() => ctx.sessions.list.getSnapshot(), [ctx])
  const list = useSyncExternalStore(subscribe, snapshot)
  const options = useMemo(() => workspaceOptions(Object.values(list.byId)), [list])

  const [picked, setPicked] = useState<string>('')
  const selected = options.find(option => option.cwd === picked) ?? options[0]
  const sessionId = selected?.sessionId

  const [draft, setDraft] = useState<Framework | null>(null)
  const [load, setLoad] = useState<LoadState>({ status: 'loading', path: '', error: '' })
  const [saveError, setSaveError] = useState<string>('')
  const [reload, setReload] = useState<number>(0)
  const currentId = draft === null ? null : pickCurrent(draft)

  useEffect(() => {
    if (sessionId === undefined) return
    let cancelled = false
    setLoad({ status: 'loading', path: '', error: '' })
    setDraft(null)
    readState(sessionId).then(view => {
      if (cancelled) return
      setDraft(view.framework)
      setLoad({ status: 'ready', path: view.path, error: '' })
    }).catch((error: unknown) => {
      if (cancelled) return
      setLoad({ status: 'error', path: '', error: error instanceof Error ? error.message : String(error) })
    })
    return () => { cancelled = true }
  }, [sessionId, reload])

  const commit = (next: Framework): void => {
    if (sessionId === undefined) return
    setDraft(next)
    let validated: Framework
    try {
      validated = parseFramework(next)
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : String(error))
      return
    }
    setSaveError('')
    saveState(sessionId, validated).then(view => {
      setLoad({ status: 'ready', path: view.path, error: '' })
    }).catch((error: unknown) => {
      setSaveError(error instanceof Error ? error.message : String(error))
    })
  }

  if (options.length === 0) return <p className={css.hint}>{t('noWorkspace')}</p>

  return (
    <div className={css.card}>
      <label className={css.field}>
        <span className={css.label}>{t('workspace')}</span>
        <select className={css.input} value={selected?.cwd ?? ''} onChange={event => setPicked(event.target.value)}>
          {options.map(option => <option key={option.cwd} value={option.cwd}>{option.cwd}</option>)}
        </select>
      </label>

      {load.status === 'loading' ? <p className={css.hint}>{t('loading')}</p> : null}
      {load.status === 'error' ? (
        <p className={css.error}>
          {t('loadFailed')}: {load.error}
          <button type="button" className={css.button} onClick={() => setReload(value => value + 1)}>{t('retry')}</button>
        </p>
      ) : null}
      {load.path === '' ? null : <p className={css.hint}>{t('path')}: {load.path}</p>}
      {saveError === '' ? null : (
        <p className={css.error}>
          {t('saveFailed')}: {saveError}
          <button type="button" className={css.button} onClick={() => { if (draft !== null) commit(draft) }}>{t('retry')}</button>
        </p>
      )}

      {load.status === 'ready' && draft === null ? (
        <div className={css.section}>
          <p className={css.hint}>{t('emptyHint')}</p>
          <button type="button" className={css.button} onClick={() => commit(emptyFramework(t('defaultTopic')))}>{t('createEmpty')}</button>
          <button type="button" className={css.button} onClick={close}>{t('goToSession')}</button>
        </div>
      ) : null}

      {draft === null ? null : (
        <>
          <div className={css.section}>
            <TextField label={t('topic')} value={draft.topic} onCommit={next => commit({ ...draft, topic: next })} />
            <label className={css.field}>
              <span className={css.label}>{t('purpose')}</span>
              <select
                className={css.input}
                value={draft.purpose.kind}
                onChange={event => commit({ ...draft, purpose: { ...draft.purpose, kind: event.target.value as PurposeKind } })}
              >
                {PURPOSE_KINDS.map(kind => <option key={kind} value={kind}>{t(PURPOSE_LABEL[kind])}</option>)}
              </select>
            </label>
            <TextField
              label={t('purposeDetail')}
              value={draft.purpose.detail}
              hint={draft.purpose.kind === 'job' ? t('purposeDetailJob') : draft.purpose.kind === 'exam' ? t('purposeDetailExam') : undefined}
              onCommit={next => commit({ ...draft, purpose: { ...draft.purpose, detail: next } })}
            />
            <TextField
              label={t('deadline')}
              type="date"
              value={draft.purpose.deadline ?? ''}
              onCommit={next => commit({ ...draft, purpose: { ...draft.purpose, deadline: next === '' ? null : next } })}
            />
            <TextField
              label={t('weeklyMinutes')}
              type="number"
              hint={t('weeklyMinutesHint')}
              value={String(draft.weeklyMinutes)}
              onCommit={next => {
                const value = Number.parseInt(next, 10)
                if (Number.isInteger(value) && value >= 0 && value <= 10080) commit({ ...draft, weeklyMinutes: value })
              }}
            />
          </div>

          <div className={css.section}>
            <span className={css.label}>{t('framework')}</span>
            <p className={css.hint}>{t('nodeCount')}: {draft.nodes.length} · {t('currentNode')}: {currentId ?? t('none')}</p>
            <ul className={css.tree}>
              {draft.nodes.map(node => (
                <li key={node.id} className={node.id === currentId ? css.nodeCurrent : css.node}>
                  <span className={css.nodeId}>{node.id}</span>
                  <span className={css.nodeTitle}>{node.title}</span>
                  <span className={css.badge}>{t(STATUS_LABEL[node.status])}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className={css.section}>
            <span className={css.label}>{t('method')}</span>
            <div className={css.methods}>
              {METHOD_IDS.map(id => (
                <button
                  key={id}
                  type="button"
                  className={draft.method === id ? css.methodOn : css.method}
                  onClick={() => commit({ ...draft, method: id, customMethod: id === 'custom' ? draft.customMethod ?? '' : null })}
                >
                  <span className={css.methodName}>{t(METHOD_LABEL[id])}</span>
                  <span className={css.methodDesc}>{t(METHOD_DESC[id])}</span>
                </button>
              ))}
            </div>
            {draft.method === 'custom' ? (
              <TextField
                label={t('customMethod')}
                value={draft.customMethod ?? ''}
                hint={t('customMethodHint')}
                onCommit={next => commit({ ...draft, customMethod: next.trim() === '' ? null : next.trim() })}
              />
            ) : null}
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 5: 迁入口到 settings.section**

整份替换 `src/client/index.ts`（Task 1 的 plugins.tab 注册迁到设置侧边栏一级页面；spec §13）：

```ts
import type { Context } from './context-types.ts'
import { SettingsCard } from './SettingsCard.tsx'
import { en, zh } from './locales.ts'

export const name = 'dsh-skill-learning-coach-client'

export const inject = ['slots', 'locale', 'sessions']

export const LOCALE_NS = 'learning.coach'

export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register(LOCALE_NS, { zh, en }), 'dsh-skill-learning-coach: dictionaries')
  const t = ctx.locale.bind(LOCALE_NS)
  ctx.effect(() => ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'learning-coach',
    order: 30,
    label: () => t('settingsTitle'),
    locale: LOCALE_NS,
    inject: () => ({ ctx }),
  }, SettingsCard)), 'dsh-skill-learning-coach: settings section')
}
```

**顺序约束：Step 4 必须在本步之前完成**——`settings.section` 的 owner props 含 `close`，探针版组件没收这个 prop，先迁入口会让 `tsc` 报组件类型不匹配（`register` 的组件参数要求接住全部 composed props）。

- [ ] **Step 6: 构建 + 纯度门 + 全部测试**

Run：`pnpm run test && pnpm run test:client-bundle`
Expected: 27 个测试全绿（Task 1-3 的 25 + 入口静态 2）；bundle 检查通过，forbidden 为空。CSS Modules 被内联成 `injectTag`，不产生新 require。

若 tsc 报 `css` 上不存在某个类名：`css-modules.d.ts` 把它声明成 `Record<string, string>`，所以不会报名字错；真报错通常是 `css` 默认导入缺失——确认 `src/client/css-modules.d.ts` 在 `src` 的 include 范围内。

- [ ] **Step 7: 提交**

```bash
git -C F:/work/dsh-skill/dsh-skill-learning-coach add src/client/index.ts src/client/SettingsCard.tsx src/client/SettingsCard.module.css src/client/locales.ts tests/settings-entry.test.mjs
git -C F:/work/dsh-skill/dsh-skill-learning-coach commit -m "feat: 设置卡迁到设置侧边栏一级页面，可改目的、时间与学习方法并即时落盘"
```

---

### Task 5: 设置卡——框架树增 / 删 / 选 / 标没懂 + 资料与达标编辑

**Files:**
- Modify: `src/client/SettingsCard.tsx`

**Interfaces:**
- Consumes: Task 2 的 `addNode` / `removeSubtree` / `replaceNode` / `nodeOf` 与类型 `Material` / `MaterialKind`；Task 4 的 `commit` / `draft` / `css` / 字典键（`nodeTitle` `addRoot` `addChild` `remove` `confirmRemove` `select` `markGap` `materials` `materialKind` `kindUrl` `kindFile` `kindBook` `materialRef` `materialEnough` `addMaterial` `removeMaterial` `mastery` `masteryHint` `misconceptions`）与 CSS 类（`nodeActions` `nodeBody` `material` `mislist`）。
- Produces: 无新导出。交付物是 spec §11.1 的可验行为：增 / 删 / 选 / 标没懂后磁盘立刻出现对应改动。

- [ ] **Step 1: 加 import 与两个局部状态**

`src/client/SettingsCard.tsx` 的 shared import 段改成（追加四个助手与两个类型）：

```ts
import {
  METHOD_IDS,
  PURPOSE_KINDS,
  addNode,
  emptyFramework,
  nodeOf,
  parseFramework,
  pickCurrent,
  removeSubtree,
  replaceNode,
  workspaceOptions,
  type Framework,
  type Material,
  type MaterialKind,
  type MethodId,
  type NodeStatus,
  type PurposeKind,
} from '../shared/framework.ts'
```

在 `const currentId = ...` 那一行之后追加：

```ts
  const [expanded, setExpanded] = useState<string | null>(null)
  const [pendingRemove, setPendingRemove] = useState<string | null>(null)
```

在 `const STATUS_LABEL ...` 常量之后追加：

```ts
const MATERIAL_LABEL: Record<MaterialKind, LocaleKey> = {
  url: 'kindUrl',
  file: 'kindFile',
  book: 'kindBook',
}

const MATERIAL_KINDS_UI: readonly MaterialKind[] = ['url', 'file', 'book']
```

- [ ] **Step 2: 把只读框架区换成可编辑树**

把 Task 4 里这一整块：

```tsx
          <div className={css.section}>
            <span className={css.label}>{t('framework')}</span>
            <p className={css.hint}>{t('nodeCount')}: {draft.nodes.length} · {t('currentNode')}: {currentId ?? t('none')}</p>
            <ul className={css.tree}>
              {draft.nodes.map(node => (
                <li key={node.id} className={node.id === currentId ? css.nodeCurrent : css.node}>
                  <span className={css.nodeId}>{node.id}</span>
                  <span className={css.nodeTitle}>{node.title}</span>
                  <span className={css.badge}>{t(STATUS_LABEL[node.status])}</span>
                </li>
              ))}
            </ul>
          </div>
```

整块替换为：

```tsx
          <div className={css.section}>
            <span className={css.label}>{t('framework')}</span>
            <p className={css.hint}>{t('nodeCount')}: {draft.nodes.length} · {t('currentNode')}: {currentId ?? t('none')}</p>
            <ul className={css.tree}>
              {draft.nodes.map(node => (
                <li key={node.id}>
                  <div className={node.id === currentId ? css.nodeCurrent : css.node}>
                    <span className={css.nodeId}>{node.id}</span>
                    <button
                      type="button"
                      className={css.nodeTitle}
                      style={{ background: 'none', border: 'none', color: 'inherit', font: 'inherit', textAlign: 'left', cursor: 'pointer' }}
                      onClick={() => setExpanded(value => (value === node.id ? null : node.id))}
                    >
                      {node.title}
                    </button>
                    <span className={css.badge}>{t(STATUS_LABEL[node.status])}</span>
                  </div>
                  <div className={css.nodeActions}>
                    <button type="button" className={css.button} onClick={() => commit({ ...draft, current: node.id })}>{t('select')}</button>
                    <button type="button" className={css.button} onClick={() => commit(replaceNode(draft, node.id, { status: 'gap' }))}>{t('markGap')}</button>
                    <button type="button" className={css.button} onClick={() => commit(addNode(draft, node.id, t('nodeTitle')))}>{t('addChild')}</button>
                    <button
                      type="button"
                      className={css.button}
                      onClick={() => {
                        if (pendingRemove === node.id) {
                          setPendingRemove(null)
                          setExpanded(value => (value === node.id ? null : value))
                          commit(removeSubtree(draft, node.id))
                        } else {
                          setPendingRemove(node.id)
                        }
                      }}
                    >
                      {pendingRemove === node.id ? t('confirmRemove') : t('remove')}
                    </button>
                  </div>
                  {expanded === node.id ? (
                    <div className={css.nodeBody}>
                      <TextField
                        label={t('nodeTitle')}
                        value={node.title}
                        onCommit={next => commit(replaceNode(draft, node.id, { title: next }))}
                      />
                      <TextField
                        label={t('mastery')}
                        value={node.mastery}
                        hint={t('masteryHint')}
                        onCommit={next => commit(replaceNode(draft, node.id, { mastery: next }))}
                      />
                      <span className={css.label}>{t('materials')}</span>
                      {node.materials.map((material, index) => (
                        <div key={index} className={css.material}>
                          <label className={css.field}>
                            <span className={css.label}>{t('materialKind')}</span>
                            <select
                              className={css.input}
                              value={material.kind}
                              onChange={event => {
                                const materials = node.materials.map((item, i) => (i === index ? { ...item, kind: event.target.value as MaterialKind } : item))
                                commit(replaceNode(draft, node.id, { materials }))
                              }}
                            >
                              {MATERIAL_KINDS_UI.map(kind => <option key={kind} value={kind}>{t(MATERIAL_LABEL[kind])}</option>)}
                            </select>
                          </label>
                          <TextField
                            label={t('materialRef')}
                            value={material.ref}
                            onCommit={next => {
                              const materials = node.materials.map((item, i) => (i === index ? { ...item, ref: next } : item))
                              commit(replaceNode(draft, node.id, { materials }))
                            }}
                          />
                          <TextField
                            label={t('materialEnough')}
                            value={material.enough}
                            onCommit={next => {
                              const materials = node.materials.map((item, i) => (i === index ? { ...item, enough: next } : item))
                              commit(replaceNode(draft, node.id, { materials }))
                            }}
                          />
                          <button
                            type="button"
                            className={css.button}
                            onClick={() => commit(replaceNode(draft, node.id, { materials: node.materials.filter((_, i) => i !== index) }))}
                          >
                            {t('removeMaterial')}
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        className={css.button}
                        onClick={() => {
                          const material: Material = { kind: 'url', ref: '', enough: '' }
                          commit(replaceNode(draft, node.id, { materials: [...node.materials, material] }))
                        }}
                      >
                        {t('addMaterial')}
                      </button>
                      {nodeOf(draft, node.id).misconceptions.length === 0 ? null : (
                        <>
                          <span className={css.label}>{t('misconceptions')}</span>
                          <ul className={css.mislist}>
                            {nodeOf(draft, node.id).misconceptions.map((entry, index) => <li key={index}>{entry}</li>)}
                          </ul>
                        </>
                      )}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
            <button type="button" className={css.button} onClick={() => commit(addNode(draft, null, t('nodeTitle')))}>{t('addRoot')}</button>
          </div>
```

**注意两个故意的设计**：
- 「加子节 / 加顶级节点」用 `t('nodeTitle')`（"节点标题"）当占位标题，因为 `parseFramework` 要求 title 非空；用户展开后改真名。不要改成空字符串，那会被校验拒。
- 「加一份资料」的 `ref` 是空字符串，`parseFramework` 会拒（`ref` 必须非空），于是 `commit` 只显示错误、不写盘，但 draft 里已经出现那一行供用户填。**填完 ref 失焦才真正落盘。** 这是 Step 3 要验的行为，不是 bug。

- [ ] **Step 3: 构建 + 全部测试 + 逐条对着 spec §11.1 自查**

Run：`pnpm run test && pnpm run test:client-bundle`
Expected: 27 个测试全绿；bundle 检查通过。

Run：`npx tsc -p tsconfig.json --noEmit`
Expected: 无输出。特别确认 `MATERIAL_LABEL` / `STATUS_LABEL` / `METHOD_LABEL` / `PURPOSE_LABEL` 四个 Record 的键覆盖了各自联合类型的全部成员（漏一个就编译错，这是故意的）。

静态自查（逐条在代码里指出对应行，写进提交说明）：
- 增：`addNode(draft, null, …)` 与 `addNode(draft, node.id, …)`
- 删：`removeSubtree(draft, node.id)`，两次点击确认
- 选：`commit({ ...draft, current: node.id })`
- 标没懂：`replaceNode(draft, node.id, { status: 'gap' })`
- 资料可编辑：三个 `TextField` + kind `select` + 删除按钮
- 达标可编辑：`mastery` 的 `TextField`
- 卡壳只读：`mislist` 只渲染，没有任何写入入口（追加由 AI 在会话里做）

- [ ] **Step 4: 提交**

```bash
git -C F:/work/dsh-skill/dsh-skill-learning-coach add src/client/SettingsCard.tsx
git -C F:/work/dsh-skill/dsh-skill-learning-coach commit -m "feat: 设置卡可增删选标路线节点并编辑资料与达标标准"
```

---

### Task 6: skill 路由与首次引导（SKILL.md / first-run / framework）

**Files:**
- Create: `tests/skill-bundle.test.mjs`
- Modify: `skills/learning-coach/SKILL.md`（整份替换，v1 是 39 行五步流程）
- Create: `skills/learning-coach/references/first-run.md`
- Create: `skills/learning-coach/references/framework.md`
- Delete: `skills/learning-coach/references/intake.md`

**Interfaces:**
- Consumes: Task 2 的 `PURPOSE_KINDS` / `NODE_STATUSES` / `MATERIAL_KINDS`（`lib/shared/framework.js`）， prose 里引用的字段名必须与 `Framework` / `FrameworkNode` 逐字一致。
- Produces: `SKILL.md` 的四条路由（first-run / coach-loop / framework / materials）。`coach-loop.md` 与 `materials.md` 由 Task 7 建，`methods/*.md` 由 Task 8 建——**本 Task 结束时这三个链接目标还不存在，所以链接可达性测试放在 Task 8**，不要提前写。

**已核实的模型细节（写 prose 时别写错）：**
- `MATERIAL_KINDS` 只有 `url | file | book`，**没有 video**。
- `pickCurrent` 不优先 `gap`：`current` 非 null 就用它，否则取 `nodes` 数组里第一个既非 `assumed-known` 也非 `done` 的节点。`gap` 与 `pending` 一视同仁，靠数组顺序。
- `purpose.detail` 是 `string`（不是 nullable）；只有 `job` / `exam` 强制非空。
- `weeklyMinutes` 允许 0–10080 的整数；`emptyFramework` 给 0。
- `materials[].enough` 用 `requireString`，**允许空串**——所以"必须写清读到什么程度算够"是 skill 层的硬约束，校验器不拦，prose 里要写死。
- 节点 id 正则 `^[1-9][0-9]*(\.[1-9][0-9]*)*$`：顶级不带点，子节必须以 `<parent>.` 开头。
- 模型里**没有复习轮次字段**。`spaced` 的轮次记在讲义页尾的「复习记录」行（Task 7 的 materials.md §8 定义，Task 8 的 spaced.md 消费）。

- [ ] **Step 1: 写失败的测试**

创建 `tests/skill-bundle.test.mjs`：

```js
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { NODE_STATUSES, PURPOSE_KINDS } from '../lib/shared/framework.js'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SKILL_DIR = join(ROOT, 'skills', 'learning-coach')

function read(relative) {
  return readFileSync(join(SKILL_DIR, relative), 'utf8').replace(/\r\n/g, '\n')
}

function lineCount(text) {
  return text.trim().split('\n').length
}

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const abs = join(dir, entry.name)
    return entry.isDirectory() ? walk(abs) : [abs]
  })
}

test('SKILL.md frontmatter：name 固定，description ≤80 字', () => {
  const text = read('SKILL.md')
  const match = /^---\n([\s\S]*?)\n---\n/.exec(text)
  assert.ok(match, 'SKILL.md 必须以 frontmatter 开头')
  const name = /^name:\s*(.+)$/m.exec(match[1])
  assert.ok(name, 'frontmatter 缺 name')
  assert.equal(name[1].trim(), 'learning-coach')
  const description = /^description:\s*(.+)$/m.exec(match[1])
  assert.ok(description, 'frontmatter 缺 description')
  const length = [...description[1].trim()].length
  assert.ok(length <= 80, `description ${length} 字，超过 80`)
})

test('SKILL.md 正文 ≤60 行', () => {
  const text = read('SKILL.md')
  const body = text.replace(/^---\n[\s\S]*?\n---\n/, '')
  const count = lineCount(body)
  assert.ok(count <= 60, `正文 ${count} 行，超过 60`)
})

test('skills/ 里只有 Markdown，没有 HTML 模板或服务脚本', () => {
  const files = walk(SKILL_DIR)
  assert.ok(files.length > 0)
  for (const file of files) assert.ok(file.endsWith('.md'), `skills/ 里出现非 Markdown 文件：${file}`)
})

test('v1 的 intake.md 已删除，first-run.md 与 framework.md 已建', () => {
  assert.equal(existsSync(join(SKILL_DIR, 'references', 'intake.md')), false, 'intake.md 必须删除，不留兼容层')
  assert.ok(lineCount(read('references/first-run.md')) >= 30)
  assert.ok(lineCount(read('references/framework.md')) >= 30)
})

test('first-run 的第一问必须是目的，一共六问', () => {
  const questions = [...read('references/first-run.md').matchAll(/^## (问 \d：.+)$/gm)].map(match => match[1])
  assert.equal(questions.length, 6, `应有六问，实际 ${questions.length}`)
  assert.ok(questions[0].startsWith('问 1：目的'), `第一问是「${questions[0]}」，不是目的`)
})

test('framework.md 覆盖全部状态、全部目的、粒度与原子写', () => {
  const text = read('references/framework.md')
  for (const status of NODE_STATUSES) assert.ok(text.includes(status), `framework.md 没提到状态 ${status}`)
  for (const kind of PURPOSE_KINDS) assert.ok(text.includes(kind), `framework.md 没提到目的 ${kind}`)
  assert.ok(text.includes('15–25'), 'framework.md 必须写死 15–25 分钟的粒度')
  assert.ok(text.includes('framework.json.tmp'), 'framework.md 必须写原子写的临时文件名')
  assert.ok(text.includes('00-路线.md'), 'framework.md 必须说明 v1 遗留文件不迁移')
})
```

- [ ] **Step 2: 跑测试确认它失败**

Run：`pnpm run build && node --test tests/skill-bundle.test.mjs`
Expected: FAIL —至少四条红：`description` 超 80 字（v1 是 108 字左右）、`intake.md` 仍存在、`first-run.md` 不存在（ENOENT）、`framework.md` 不存在。

- [ ] **Step 3: 整份替换 `skills/learning-coach/SKILL.md`**

````markdown
---
name: learning-coach
description: 按学习目的生成知识框架，带引导式陪练到无提示产出。Use when the user says 我想学 X / 继续学 / 帮我规划学习.
whenToUse: 用户说"我想学 X / 继续学 / 我不知道下一步学什么 / 给我学习路线"，或要按某个学习法带练时。
---

# Learning Coach

你是这位学习者的贴身教师。状态在盘上：`<工作区>/learning/framework.json`。
渲染全在 DSH 设置卡（设置 → 内置插件 → 学习路线）。你**不生成 HTML、不生成图表、不在聊天里画路线树**。

## 0 每轮硬约束

1. 只读 `current` 那一个节点，不读整张框架图；不重读本次会话已读过的 reference。
2. 方法库按方法分片：`references/methods/<method>.md`，选哪个才读哪个。
3. 长讲解写进讲义文件，聊天只留短指令。
4. 每轮只问一个问题；回复 ≤150 字；不复述学习者原话；不重复讲已讲过的原理；不先给答案。
5. 一节一 session。收口提醒开新会话——状态在盘上，断了能续。
6. `misconceptions` 只追加，永不清空或改写。开场必须引用上次卡壳，否则"贴身"是假的。

## 1 路由：先看盘上有没有 framework.json

用 fs 工具读 `<工作区>/learning/framework.json`。

- **不存在 / 读不出** → 读 [first-run.md](references/first-run.md)，走首次引导。
- **存在** → 只取 `current` 指向的那一个节点（连同它的 `misconceptions`、`materials`、`mastery`），读 [coach-loop.md](references/coach-loop.md)。节点是 `gap` 或 `drafted` 也走这条，不要重跑框架。

## 2 需要生成或改框架时

读 [framework.md](references/framework.md)：节点粒度、按目的裁剪、状态机、`current` 选取、依赖护栏。
**写盘一律用 fs 工具做原子写**：先写 `learning/framework.json.tmp`，再 rename 成 `learning/framework.json`。
写前按 framework.md 自查字段；`mastery` 不是一件可验证的动作就不许落盘。

## 3 需要写讲义时

只写当前一节，一次一页，落 `learning/讲义/<YYYY-MM-DD>-<节点标题>.md`。
模板与「达标动作按 purpose 变形」读 [materials.md](references/materials.md)。
**禁止批量生成整套课程讲义。** 学习者要求全部生成时，说明为什么一次一页，然后只交当前这一页。

## 4 收口（每节必做）

写回 `framework.json`：状态、`minutesSpent`、新追加的卡壳、`reviewOn`（仅 `spaced`）。
报三件事：路线在哪 / 这页讲义在哪 / 下一节第一个动作。然后提醒开新会话。
不给掌握度打分，不宣称"你已经学会了"——**无提示产出**达标才算走完。
````

- [ ] **Step 4: 创建 `skills/learning-coach/references/first-run.md`**

````markdown
# 首次引导（framework.json 不存在时）

每轮只问一个问题，回复 ≤150 字。问不出时用括号里的兜底，并说明"这个假设随时能改"。
六问收齐才生成框架。**不要一次把六问全抛出来。**

## 问 1：目的（必须第一个问）

"你学这个是为了工作、考试、兴趣，还是转行？"
拿到 kind 后追问 detail：
- `job` → 目标岗位是什么（detail 必须含岗位名，如"后端求职面试"）
- `exam` → 哪门考试（detail 必须含考试名）
- `career-switch` → 从什么转到什么
- `interest` → 想做出什么具体的东西

再问期限："希望什么时候达到？"没有硬期限就写 `null`，别编一个日期。

**目的决定后面一切**：路径裁剪、节点顺序、`mastery` 的形态。
工作 → 能跑的东西 / 能在评审里讲清；考试 → 限时答对真题；兴趣 → 做出一个自己真会用的成品；转行 → 能拿去面试讲的项目片段。

## 问 2：现状（要动作，不要"了解"）

"现在不看资料，你能独立做到哪一步？"
不接受"了解一点""看过教程"。追问成一个具体动作（能写出什么 / 能跑通什么 / 能答对哪类题）。
这一步决定框架从哪里起步，避免把已会的排进去。

## 问 3：真实时间

"过去一周你实际花在这上面多少分钟？"
**不要问"你计划每周学多久"**——理想计划会虚高。拿这个数写 `weeklyMinutes`。
（兜底：先按 150 分钟写，告诉他随时能在设置卡里改。）

## 问 4：资料

"手上有教材、课程、文档链接或本地文件吗？"
- 有 → 本地路径用 fs 读，链接用 tool-web 的 fetch 读；按框架排先后，每份写清 `enough`（读到什么程度算够）。
- 没有 → 用 tool-web 的 search + fetch 找 2–3 个一手来源（官方文档、规范、教材章节优先），写进 `materials` 并附 URL 与访问日期。
- 找不到就直说找不到，**不用"网上有很多教程"糊过去**。
- 付费或需登录的资料不抓。

## 问 5：方法

"学习方法在设置卡里选：设置 → 内置插件 → 学习路线 → 底部 8 张卡。选好告诉我一声。"
他不想开设置卡时，用一句话报出八个名字让他口头选，你把 id 写进 `method`。
选 `custom` 必须问清他的方法具体怎么做，写进 `customMethod`（非空，否则校验会拒）。

## 问 6：确认框架

按 [framework.md](framework.md) 生成框架，然后**只报三件事**：一共几节、第一节标题、第一节第一个动作。
问一句："这个切法你认吗？想拆细或合并哪一节？"
**不要在聊天里贴整棵树**——树在设置卡里看。

## 沿框架问，再落盘

确认后按 framework.md §7 一块一块问：每轮一个问题，问完默认 `assumed-known`，他说没懂只标那一个 `gap`。
问完整张图才写 `<工作区>/learning/framework.json`（原子写：先 `.tmp` 再 rename）。不要边问边写。
落盘后给当前节的行动清单，转 [coach-loop.md](coach-loop.md)。
````

- [ ] **Step 5: 创建 `skills/learning-coach/references/framework.md`**

````markdown
# 框架：生成规则、粒度、状态机、依赖护栏

`<工作区>/learning/framework.json` 是唯一状态源。字段与校验以包内 `src/shared/framework.ts` 的 `parseFramework` 为准；
写盘前自查下面几条，非法就别落盘——设置卡打开时会报错，学习者会看到红字。

## 1 节点粒度

- 一节 = **15–25 分钟能收口**。收口指做完那件 `mastery` 动作，不是"读完"。
- 用 `weeklyMinutes ÷ 20` 估一周能推进几节，据此裁总量。宁可少排，不要排一张学不完的图。
- 两层就够：顶级 `parent: null` 是模块，子节是可学的一节。id 用 `"3"` / `"3.2"` 这种点分字符串，父必须先存在，编号从 1 起、不含 0。
- 一个节点只讲一个能独立验证的点。"TCP 与 UDP"要拆成两节。

## 2 按 purpose 裁剪

| kind | 路径顺序 | mastery 形态 |
| --- | --- | --- |
| `job` | 面试高频 + 岗位真用到的先学，边角后置 | 能跑的最小东西 / 能在评审里讲清一个取舍 |
| `exam` | 按考纲分值权重排，真题覆盖优先 | 限时答对一道真题，并说出考点 |
| `interest` | 到做出成品的最短路径，理论够用就行 | 做出一个自己真会用的成品片段 |
| `career-switch` | 目标岗位 JD 里的硬要求先补 | 能拿去面试讲的项目片段 + 一句取舍理由 |

`deadline` 近 → 砍掉"以后可能有用"的节点，只留达标必需的。
`purpose.detail` 里的岗位名 / 考试名要真的出现在 `mastery` 里，别写成通用句。

## 3 每个节点必须写全三件

- `materials`：1–3 份，每份 `{kind, ref, enough}`。`kind` 只能是 `url` / `file` / `book`（**没有 video**）；`ref` 必须非空。
  `enough` 写清**读到什么程度算够**（"能画出三段报文交换图"，不是"读完第 3 章"）。校验器允许 `enough` 为空，但你不许留空。
- `mastery`：**一件可验证的动作**，要能被另一个人当场判定做到了没有。禁止"读完某章""理解某概念""掌握 X"。
- `misconceptions`：初始 `[]`，之后**只追加**。

其余字段：`status` 见 §4，`reviewOn` 仅 `spaced` 用（否则 `null`），`lecture` 是相对工作区的路径（没写讲义就 `null`），`minutesSpent` 从 0 起累加。

**校验器只拦形状，不拦教学法**：`mastery` 允许空串、`materials` 允许空数组、`enough` 允许空串（设置卡新建节点时就是这三件全空）。所以"写全三件"是你自己的责任，落盘前逐条自查，别指望报错提醒你。

## 4 状态机

`pending`（还没问）→ 问完默认 `assumed-known` → 学习者说没懂 = `gap` → 生成讲义 = `drafted` → 无提示产出达标 = `done`。

- **默认已懂**：问完一块他没提出异议就标 `assumed-known`，不要反复确认。
- **只标那一个**：他说没懂，只把那个节点标 `gap`，不牵连兄弟节点、不重跑整张图。
- 给到阶梯提示第三级（直接给答案）→ 标 `gap`，**不算达标**。
- `done` 不是终点：`method: spaced` 时按 `reviewOn` 回来复习。

## 5 current 怎么选

学习者在设置卡点选的优先（他会直接改 `current`，非 null 就用它）。
没点选时 = 按 `nodes` 数组顺序第一个既非 `assumed-known` 也非 `done` 的节点。`gap` 与 `pending` 一视同仁，靠数组顺序，**不要自己发明"gap 优先"的规则**。

## 6 依赖护栏

准备学某节时发现它依赖一个 `gap` 节点 → **只补那一节**，补完回来继续。
不重跑整张图，不重新问已经 `assumed-known` 的部分。补的那节收口后把 `current` 改回原来要学的节。

## 7 沿框架问（首次引导用）

一块一块问，每轮一个问题："这一块你现在能独立做到 X 吗？"（X 是该节的 `mastery`）
- 能 / 没异议 → `assumed-known`
- 说没懂 / 答不上 → `gap`，并记一句他卡在哪进 `misconceptions`

问完整张图才落盘。不要边问边写。

## 8 写盘

**AI 一律用 fs 工具做原子写**：先写 `learning/framework.json.tmp`，再 rename 成 `learning/framework.json`。
host 路由（设置卡走的那条）会拒绝任何删改已有卡壳的写入；你用 fs 写时没有这道闸，所以更要自己守住"只追加"。
不写 `learning/00-路线.md`——那是 v1 的产物，已生成的旧文件留着不动，**不迁移、不留兼容层**。
````

- [ ] **Step 6: 删除 v1 的 intake.md**

```bash
git -C F:/work/dsh-skill/dsh-skill-learning-coach rm skills/learning-coach/references/intake.md
```

- [ ] **Step 7: 跑测试确认全绿**

Run：`pnpm run test`
Expected: PASS —原有 27 个 + 本 Task 6 个 = 33 个测试全绿。
特别确认 `description ≤80 字` 与 `正文 ≤60 行` 两条：Step 3 的正文是 38 行、description 是 69 字，都在预算内。若你改过 prose 导致超线，**删字而不是放宽测试**。

- [ ] **Step 8: 提交**

```bash
git -C F:/work/dsh-skill/dsh-skill-learning-coach add skills/learning-coach/SKILL.md skills/learning-coach/references/first-run.md skills/learning-coach/references/framework.md tests/skill-bundle.test.mjs
git -C F:/work/dsh-skill/dsh-skill-learning-coach commit -m "feat: skill 路由瘦身到 38 行，首次引导改为目的优先"
```

---

### Task 7: 陪练循环与讲义模板（coach-loop / materials）

**Files:**
- Create: `tests/skill-coach.test.mjs`
- Create: `skills/learning-coach/references/coach-loop.md`
- Modify: `skills/learning-coach/references/materials.md`（整份替换 v1 的六段模板）

**Interfaces:**
- Consumes: Task 6 的 `SKILL.md` §1 路由（回访 → coach-loop）、`framework.md` §4 状态机与 §8 原子写。
- Produces: `coach-loop.md` 的六步循环（开场引用卡壳 → 行动清单 → 引导陪练 → 阶梯提示 → 无提示产出 → 收口写回）；`materials.md` §7 的 purpose→达标动作对照表与 §8 的「复习记录」行格式。
  **§8 那行格式是 Task 8 `spaced.md` 的唯一轮次来源**（JSON 模型里没有复习轮次字段），逐字固定为：`复习记录：达标日 YYYY-MM-DD；已复习 N 次`。

- [ ] **Step 1: 写失败的测试**

创建 `tests/skill-coach.test.mjs`：

```js
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { PURPOSE_KINDS } from '../lib/shared/framework.js'

const SKILL_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'skills', 'learning-coach')

function read(relative) {
  return readFileSync(join(SKILL_DIR, relative), 'utf8').replace(/\r\n/g, '\n')
}

test('coach-loop 有阶梯提示三级，且给到答案就标 gap', () => {
  const text = read('references/coach-loop.md')
  assert.ok(text.includes('阶梯提示'))
  for (const level of ['方向', '半个步骤', '答案']) assert.ok(text.includes(level), `缺第 ${level} 级`)
  assert.match(text, /第 3 级.*`gap`/, '必须写明给到第 3 级就标 gap')
  assert.ok(text.includes('不算达标'))
})

test('coach-loop 守住省 token 与只追加两条硬约束', () => {
  const text = read('references/coach-loop.md')
  assert.ok(text.includes('150'), '必须写死回复 ≤150 字')
  assert.ok(text.includes('misconceptions'))
  assert.match(text, /不要清空或改写任何已有卡壳/)
  assert.ok(text.includes('新会话'), '收口必须提醒开新会话')
  assert.ok(text.includes('只读选中的那一份'), '方法库必须选哪个读哪个')
})

test('materials 保留强制自标行与待核实规则', () => {
  const text = read('references/materials.md')
  assert.ok(text.includes('本页为 AI 现写的辅助讲义'), '页首自标行不可省略')
  assert.ok(text.includes('待核实'))
  assert.ok(text.includes('一个具体故事开场'))
})

test('materials 的达标动作按四种 purpose 变形，并禁止不可验证表述', () => {
  const text = read('references/materials.md')
  for (const kind of PURPOSE_KINDS) assert.ok(text.includes(`\`${kind}\``), `缺 purpose ${kind} 的达标形态`)
  assert.ok(text.includes('读完某章'), '必须点名禁止"读完某章"')
  assert.ok(text.includes('整门课'), '必须保留批量禁令')
})

test('materials 定义 spaced 的复习记录行，格式逐字固定', () => {
  const text = read('references/materials.md')
  assert.ok(text.includes('复习记录：达标日 YYYY-MM-DD；已复习 N 次'), '复习记录行格式被改动了，spaced.md 会读不到')
})
```

- [ ] **Step 2: 跑测试确认它失败**

Run：`pnpm run build && node --test tests/skill-coach.test.mjs`
Expected: FAIL —第一条就 ENOENT（`references/coach-loop.md` 不存在）。

- [ ] **Step 3: 创建 `skills/learning-coach/references/coach-loop.md`**

````markdown
# 陪练循环（已有 framework.json 时）

你已经只读了 `current` 那一个节点。开场先做两件事，然后进循环。

## 0 开场（≤150 字）

1. **引用上次卡壳**：`misconceptions` 非空就挑最近一条，用一句话点出来（"上次你把'确认收到'当成第三次握手的唯一目的"）。空就跳过。
2. 报这一节的 `mastery`：一句"这一节结束时你要能……"。

不要复述整张框架，不要重讲已讲过的原理。

## 1 行动清单（先给清单，再开始练）

三到五条，每条是一个**动作**，不是"阅读 X"。按选定方法排。例（费曼）：
1. 打开 `materials[0].ref`，读到能画出三段报文交换图就停（那是 `enough`）
2. 合上资料，把我当不懂的新人讲一遍
3. 我挑卡壳，你重讲
4. 不看资料做一遍 `mastery`

清单给完问一句："从第 1 条开始？"——**每轮只问一个问题**。
`method` 是 `custom` 时按 `customMethod` 的描述排清单，不要套上面这个模板。

## 2 引导陪练

读 `references/methods/<method>.md`（路径相对 skill 根目录，与 SKILL.md 里的写法一致），**只读选中的那一份**，按它的步骤带。通用规则：
- 你先让他做，不要先讲。他做不出来才提示。
- 他卡住 → 把卡壳要点追加进 `misconceptions`（一句，≤40 字），然后给阶梯提示。
- 不替他总结。总结必须由他产出。

## 3 阶梯提示（三级，逐级给）

1. **方向**：指一下该往哪想（"想想如果那个包丢了会怎样"）。不给步骤。
2. **半个步骤**：给出第一步或关键中间量，剩下让他补。
3. **答案**：直接讲清。

**给到第 3 级就把这一节标 `gap`，不算达标**，收口时说明"这节要重学"。
每给一级都停下来让他再试一次，不要连着三级一口气说完。

## 4 无提示产出（达标的唯一判据）

撤掉所有提示，让他独立完成节点里那句 `mastery`。
- 做到了 → `status: "done"`
- 没做到 → 回到第 3 步；已经给过答案就标 `gap`

判定要具体：他说"我懂了"不算，**做出那件动作**才算。

## 5 收口写回

用 fs 原子写 `learning/framework.json`（先 `.tmp` 再 rename），只改这几处：
- 当前节 `status`、`minutesSpent`（累加这次真实分钟数）、新追加的 `misconceptions`
- 写了讲义 → `lecture` 填相对工作区的路径，`status` 至少 `drafted`
- `method: "spaced"` → 按 `methods/spaced.md` 算 `reviewOn`
- `current`：这一节 `done` 就改成下一个待学节点（`nodes` 顺序里第一个既非 `assumed-known` 也非 `done`）；标 `gap` 就留着，下次先补它

**不要清空或改写任何已有卡壳。**

## 6 报三件事 + 提醒换会话

≤150 字：路线在哪（`learning/framework.json`，设置卡里可视化看）/ 这页讲义在哪 / 下一节第一个动作是什么。
最后一句固定提醒："这一节收口了，开个新会话学下一节——状态在盘上，新会话我读得到。"
不给掌握度打分，不说"你已经学会了"。
````

- [ ] **Step 4: 整份替换 `skills/learning-coach/references/materials.md`**

````markdown
# 单页讲义模板（materials）

一次只写 `current` 那一节的一页，落 `learning/讲义/<YYYY-MM-DD>-<节点标题>.md`。
目标：读完能回答页首那几个问题，并能**不看这页**做出节点的 `mastery`。

页首第一行必须是自标，不可省略、不可改写：

> 本页为 AI 现写的辅助讲义，用于快速建立骨架；以文末来源为准。说法与官方文档冲突时，以来源为准，未经核实的已标「待核实」。

第二行写这一节的达标动作：逐字抄节点的 `mastery`，并按 §7 按 purpose 变形。

## 1 先给问题

这一节读完你要能回答的 2–3 个问题。只列问题，不给答案。

## 2 一个具体故事开场

用一个人 + 一件具体的事，讲清"没有它会怎样"。不要拿术语堆叠开头；名词第一次出现就给一句人话解释。
**不要堆表格、不要贴大段代码。** 一个故事讲透一个点。

## 3 原理

从"为什么需要它"推到"它是怎么做到的"。可以给最小可跑例子，不超过 20 行。
不确定的一律写「待核实」——不编造数字、API 名、版本行为。

## 4 三道自测题

- 回忆：这一节解决什么问题
- 应用：给一个场景，他该怎么选、怎么做
- 追问：面试官或真实故障会怎么继续往下挖

答案统一放页尾折叠区，读完再对。

## 5 常见踩坑

2–3 条，每条一句"错在哪 + 为什么会这么错"。
这一节 `misconceptions` 里已有的卡壳**必须**在这里出现一条，写成"你上次错在哪"。

## 6 来源

联网查到的 2–3 个一手来源：URL + 访问日期 + 一句话说明它权威在哪（官方文档、规范、教材章节优先，二手博客不作唯一来源）。
资料来自学习者自己的文件时：写文件路径与对应段落位置，不复制原文大段进讲义。
每份来源后面带上节点 `materials[].enough` 那句"读到什么程度算够"。

## 7 达标动作按 purpose 变形

`mastery` 的形态由 `purpose.kind` 决定，写讲义时把它落成一件真场景里的小事：

| kind | 达标动作长什么样 | 例 |
| --- | --- | --- |
| `job` | 能跑的最小东西，或能在评审里讲清一个取舍 | "不看资料画出三次握手图，并说出第三次防的是什么" |
| `exam` | 限时答对一道真题，并说出考点 | "8 分钟内做对 2023 年第 17 题，说出考的是拥塞控制哪一条" |
| `interest` | 做出一个自己真会用的成品片段 | "给自己的小工具加上重试，断网时不再崩" |
| `career-switch` | 能拿去面试讲的项目片段 + 一句取舍理由 | "在项目里换掉轮询，讲清为什么选 WebSocket 而不是 SSE" |

`purpose.detail` 里的岗位名 / 考试名要真的出现在动作里，别写成通用句。
**禁止**"读完某章""理解某概念""掌握 X"这类不可验证表述。

## 8 复习记录（仅 method: spaced）

页尾固定一行，供下次复习算间隔。格式逐字照抄，不要改标点：

`复习记录：达标日 YYYY-MM-DD；已复习 N 次`

首次生成时 N = 0、达标日写 `待定`；无提示产出达标那天把 `待定` 换成真实日期。
每次复习达标把 N +1，并按 [methods/spaced.md](methods/spaced.md) 更新 `reviewOn`。
JSON 模型里没有复习轮次字段，**这一行就是轮次的唯一载体**。

## 9 批量禁令

学习者要求"把整门课讲义都写出来"时：先说明为什么一次一页（写完这一页要读完、要练到无提示产出，再决定下一节怎么走），然后**只交当前这一页**。
````

- [ ] **Step 5: 跑测试确认全绿**

Run：`pnpm run test`
Expected: PASS —33 + 5 = 38 个测试全绿。

- [ ] **Step 6: 提交**

```bash
git -C F:/work/dsh-skill/dsh-skill-learning-coach add skills/learning-coach/references/coach-loop.md skills/learning-coach/references/materials.md tests/skill-coach.test.mjs
git -C F:/work/dsh-skill/dsh-skill-learning-coach commit -m "feat: 引导式陪练循环与按目的变形的单页讲义模板"
```

---

### Task 8: 八份方法库（每份 ≤40 行，选哪个读哪个）

**Files:**
- Create: `tests/methods.test.mjs`
- Create: `skills/learning-coach/references/methods/feynman.md`
- Create: `skills/learning-coach/references/methods/recall.md`
- Create: `skills/learning-coach/references/methods/spaced.md`
- Create: `skills/learning-coach/references/methods/interleave.md`
- Create: `skills/learning-coach/references/methods/pomodoro.md`
- Create: `skills/learning-coach/references/methods/sq3r.md`
- Create: `skills/learning-coach/references/methods/cornell.md`
- Create: `skills/learning-coach/references/methods/custom.md`

**Interfaces:**
- Consumes: Task 2 的 `METHOD_IDS`（文件名必须与它逐字一致，多一个少一个都算失败）、`SPACED_INTERVALS = [1,3,7,14,30]`；Task 7 `materials.md` §8 的复习记录行；Task 6 `framework.md` §4 状态机。
- Produces: 八份可独立阅读的方法卡。每份第一行 H1 固定形态 `# <中文名>（<id>）`，都要有 `## 这一节怎么做` 或等价的分步小节与 `## 别做`。`custom.md` 只给护栏，具体步骤以 `customMethod` 为准。

- [ ] **Step 1: 写失败的测试**

创建 `tests/methods.test.mjs`：

```js
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { METHOD_IDS, SPACED_INTERVALS } from '../lib/shared/framework.js'

const SKILL_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'skills', 'learning-coach')
const METHODS_DIR = join(SKILL_DIR, 'references', 'methods')

function read(abs) {
  return readFileSync(abs, 'utf8').replace(/\r\n/g, '\n')
}

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const abs = join(dir, entry.name)
    return entry.isDirectory() ? walk(abs) : [abs]
  })
}

test('methods/ 的文件名与 METHOD_IDS 一一对应，不多不少', () => {
  const actual = readdirSync(METHODS_DIR).sort()
  assert.deepEqual(actual, METHOD_IDS.map(id => `${id}.md`).sort())
})

test('每份方法卡 ≤40 行，H1 带 id，且有分步与别做两节', () => {
  for (const id of METHOD_IDS) {
    const text = read(join(METHODS_DIR, `${id}.md`))
    const lines = text.trim().split('\n')
    assert.ok(lines.length <= 40, `${id}.md ${lines.length} 行，超过 40`)
    assert.ok(lines[0].startsWith('# '), `${id}.md 第一行必须是 H1`)
    assert.ok(lines[0].includes(`（${id}）`), `${id}.md 的 H1 必须带 id：${lines[0]}`)
    assert.ok(text.includes('## 别做'), `${id}.md 缺「别做」小节`)
    assert.ok(/^## /m.test(text.slice(lines[0].length)), `${id}.md 除 H1 外还要有分步小节`)
  }
})

test('spaced 写死间隔表、毕业条件与轮次来源', () => {
  const text = read(join(METHODS_DIR, 'spaced.md'))
  for (const days of SPACED_INTERVALS) assert.ok(text.includes(`+${days}`), `spaced.md 缺 +${days} 天`)
  assert.ok(text.includes('reviewOn'))
  assert.ok(text.includes('null'), '第五次复习后必须写 reviewOn: null')
  assert.ok(text.includes('复习记录：达标日'), '必须从讲义页尾那行拿轮次，不要问学习者')
  assert.ok(text.includes('没有调度器'), '必须写明不起后台进程')
})

test('custom 以 customMethod 为准，且保留通用护栏', () => {
  const text = read(join(METHODS_DIR, 'custom.md'))
  assert.ok(text.includes('customMethod'))
  assert.ok(text.includes('不要偷偷换成'), '必须禁止擅自改用内置方法')
  for (const guard of ['150', 'misconceptions', 'gap', 'mastery', '新会话']) {
    assert.ok(text.includes(guard), `custom.md 缺护栏 ${guard}`)
  }
})

test('整个 skill bundle 的相对链接全部可达', () => {
  const files = walk(SKILL_DIR).filter(file => file.endsWith('.md'))
  assert.equal(files.length, 13, `skill bundle 应有 13 份 Markdown，实际 ${files.length}`)
  let checked = 0
  for (const file of files) {
    for (const match of read(file).matchAll(/\]\(([^)]+)\)/g)) {
      const href = match[1].split('#')[0]
      if (href === '' || /^[a-z]+:/i.test(href)) continue
      const target = resolve(dirname(file), href)
      assert.ok(existsSync(target), `${file} 链接到不存在的 ${href}`)
      checked += 1
    }
  }
  assert.ok(checked >= 8, `只检查到 ${checked} 条链接，路由可能没写全`)
})
```

- [ ] **Step 2: 跑测试确认它失败**

Run：`pnpm run build && node --test tests/methods.test.mjs`
Expected: FAIL —第一条就 ENOENT（`references/methods/` 目录不存在）。

- [ ] **Step 3: 创建八份方法卡**

`skills/learning-coach/references/methods/feynman.md`：

````markdown
# 费曼技巧（feynman）

核心：讲给不懂的人听 → 找卡壳 → 简化重讲。讲不清就是没懂。

## 这一节怎么做

1. 让他先读 `materials`，读到每份的 `enough` 就停。
2. 你说："把我当成完全不懂的新人，讲一遍这一节。不许用术语，用了就要当场解释。"
3. 他讲的时候只做两件事：挑黑话（用了没解释的词）、挑卡壳（讲不下去或讲错的地方）。
4. 每个卡壳追加一句进 `misconceptions`（≤40 字），然后给阶梯提示第 1 级。
5. 让他重讲。重讲还卡 → 第 2 级。仍卡 → 第 3 级（给答案），**这一节标 `gap`，不算达标**。
6. 重讲通了 → 撤掉提示，让他独立做节点的 `mastery`。做到了标 `done`。

## 别做

- 别替他讲。你一讲，这一节就变成"听懂了"而不是"学会了"。
- 别接受"大概就是这样"。追问一句"具体是哪一步？"
- 别一次挑五个卡壳。挑最要命的一个，解决完再下一个。

## 写回

`misconceptions` 追加（只追加）、`status`、`minutesSpent`；用过第 3 级提示就写 `gap`。
````

`skills/learning-coach/references/methods/recall.md`：

````markdown
# 主动回忆（recall）

核心：合上资料先答，再对照补漏。往外掏的那一下才是记忆发生的地方。

## 这一节怎么做

1. 让他读 `materials` 到 `enough`，然后**合上**。
2. 你出 3 个问题（回忆 / 应用 / 追问各一），一次只问一个。
3. 他答完再让他打开资料自己对照，自己指出漏了什么。不要你替他对照。
4. 漏掉的点追加进 `misconceptions`，然后**只针对漏的那一点**再问一遍。
5. 三题都能不看资料答出 → 让他做节点的 `mastery`。做到了标 `done`。

## 别做

- 别在他答之前给提示或选项。给了就变成再认，不是回忆。
- 别问"是不是这样？"——那是判断题，猜也有五成。问开放句。
- 他答错时别立刻讲正确答案，先问"你是怎么想的？"，卡壳点往往在推理里。

## 写回

`misconceptions` 追加漏点、`status`、`minutesSpent`。给过答案的节点标 `gap`。
````

`skills/learning-coach/references/methods/spaced.md`：

````markdown
# 间隔重复（spaced）

核心：快忘的时候复习一次，比连着刷十遍有用。日期由你算，**没有调度器、不起后台进程**。

## 间隔表（固定）

达标当日 D 之后：D+1、D+3、D+7、D+14、D+30。第 5 次复习完成后 `reviewOn` 写 `null`（这一节毕业）。

## 首次达标

1. 按 [../coach-loop.md](../coach-loop.md) 带到无提示产出，标 `done`。
2. 在这一节讲义页尾写 `复习记录：达标日 D；已复习 0 次`（格式见 [../materials.md](../materials.md) §8，把 D 换成真实日期）。
3. `reviewOn` = D+1。

## 复习会话（reviewOn 到了，或学习者说"复习"）

1. 读讲义页尾那行，拿到 D 与 N。**不要问学习者"这是第几次复习"**——盘上有。
2. 不出新题。让他不看资料重做这一节的 `mastery`。
3. 做到了 → N+1，`reviewOn` = D + 间隔表[N]（N 从 0 起：0→1 天、1→3 天、2→7 天、3→14 天、4→30 天）；N 到 5 → `reviewOn: null`。
4. 没做到 → `status` 退回 `gap`，`reviewOn` 留原值，追加卡壳，按 coach-loop 的阶梯提示重学；重学达标后 D 改成今天、N 归 0。
5. `lecture` 为 null 时先按 materials.md 建这一页，复习记录写进去。

## 别做

- 别一次复习好几节。一节一 session 的规矩不变。
- 别在复习会话里讲新内容。复习就是撤掉提示重做那件动作。
- 别自己发明间隔。表就是 +1 / +3 / +7 / +14 / +30。

## 写回

`reviewOn`、`status`、`minutesSpent`、`misconceptions` 追加，以及讲义页尾那行复习记录。
````

`skills/learning-coach/references/methods/interleave.md`：

````markdown
# 交错练习（interleave）

核心：相邻主题混着练，不刷同一类题。看着更累，但迁移能力更强。

## 这一节怎么做

1. 从框架里挑**与当前节相邻或易混**的另外 1–2 节，只读它们的 `title` 与 `mastery`，不读全文。
2. 出一组混合练习：当前节的题与那几节的题**交替**出现，不要连着出同一类。
3. 一次只问一题。他答完先问"这题考的是哪一节？"——判断题型本身就是训练。
4. 分不清 / 用错方法的地方追加进 `misconceptions`，写成"把 A 的做法用到 B 上"这种可复用的句子。
5. 混合组里当前节的题都能独立做对 → 让他做节点的 `mastery`，标 `done`。

## 挑哪几节混

优先挑**看起来像但做法不同**的（TCP vs UDP、栈 vs 队列、并列 vs 嵌套）。
框架里没有易混节时直说"这一节暂时没得混"，退回主动回忆式三题，不要硬凑。

## 别做

- 别把整张框架的节点都拉进来。最多 2 个陪练节。
- 别在他答错时立刻讲。先让他自己说是哪一类题。
- 别把别的节标 `done`——你只读了它们的标题，没验证过。

## 写回

只改当前节的 `status` / `minutesSpent` / `misconceptions`。陪练节的状态一个都不动。
````

`skills/learning-coach/references/methods/pomodoro.md`：

````markdown
# 番茄钟 + 刻意练习（pomodoro）

核心：25 分钟一块，只练最弱那一点。练完就停，不拖。

## 这一节怎么做

1. 开场问一句："这 25 分钟你现在能开始吗？"（每轮只问一个问题）
2. 从 `misconceptions` 里挑**最近一条**当靶子；没有卡壳就挑 `mastery` 里最难的那半句。
3. 给一个 25 分钟的动作清单：5 分钟读 `materials` 到 `enough`，15 分钟只练那一个靶子，5 分钟不看资料复述。
4. 练的过程中他卡住 → 阶梯提示第 1 级，追加卡壳。**不要扩展到这节的其他内容。**
5. 25 分钟到 → 让他做 `mastery`。做到了标 `done`；没做到标 `gap`，收口。

## 时间怎么算

你不计时，也没有定时器。让学习者自己看钟，结束时告诉你实际用了多少分钟，写进 `minutesSpent`。
他说超时了就收口，不要为了讲完而拖——**超时本身就是这一节切太大的信号**，收口时建议拆成两节（改框架见 [../framework.md](../framework.md)）。

## 别做

- 别在一个番茄里塞两个知识点。
- 别把"读完了"当达标。达标永远是那件可验证动作。
- 别在他没开始时就讲原理。

## 写回

`minutesSpent` 累加真实分钟数、`status`、`misconceptions` 追加。建议拆节时只给建议，改不改由学习者在设置卡里定。
````

`skills/learning-coach/references/methods/sq3r.md`：

````markdown
# SQ3R 精读法（sq3r）

核心：浏览-提问-读-复述-复习。专门用来啃官方文档和规范。

## 这一节怎么做

1. **浏览**：让他先看 `materials[0]` 的标题、小标题、图表、摘要，2 分钟。问："这一份大概在讲什么？"
2. **提问**：让他把小标题改成问题（"拥塞控制"→"什么时候要降速？"）。你补一个他没想到的。
3. **读**：带着那几个问题读到 `enough` 就停。**不要通读全文。**
4. **复述**：合上资料，让他用自己的话回答那几个问题。一次问一个。答不上就追加卡壳、给阶梯提示第 1 级。
5. **复习**：让他做节点的 `mastery`。做到了标 `done`。

## 资料是规范或 RFC 时

先让他定位到相关章节号，再读那一段。MUST / SHOULD / MAY 要他逐个说清差别——这是最常见的卡壳点，出现了就追加进 `misconceptions`。

## 别做

- 别替他提问。问题由他生出来，他才会在读的时候找答案。
- 别让他从头读到尾。`enough` 就是停止线。
- 别把复述变成背原文。要他自己的话。

## 写回

`status`、`minutesSpent`、`misconceptions` 追加。`materials[].enough` 太宽时可以在收口建议他改窄（设置卡里能改）。
````

`skills/learning-coach/references/methods/cornell.md`：

````markdown
# 康奈尔笔记（cornell）

核心：线索栏 / 笔记栏 / 总结栏。总结栏必须由学习者写，你写的就不是他的。

## 这一节怎么做

1. 让他在讲义文件末尾（或自己新建 `learning/笔记/<节点标题>.md`）分三块：左边写线索问题，右边写笔记，底部写总结。
2. **笔记栏**：他读 `materials` 时自己记。你不代笔，也不要把讲义内容复制过去。
3. **线索栏**：读完后让他把每段笔记压成一个问题（"这段能回答什么？"）。压不出问题的段落就是没读懂，追加进 `misconceptions`。
4. **总结栏**：合上资料，让他用两三句话总结这一节。**他写不出来就别给答案**，走阶梯提示。
5. 遮住笔记栏，只看线索栏的问题自答一遍。答得出 → 让他做 `mastery`，标 `done`。

## 别做

- 别替他写总结栏。这是这套方法唯一有效的部分。
- 别把三块做成填空题让他抄。抄写不产生理解。
- 笔记文件路径不要写进 `lecture`（`lecture` 只指 AI 现写的那页讲义）。

## 写回

`status`、`minutesSpent`、`misconceptions` 追加。笔记文件由学习者自己维护，你不改它。
````

`skills/learning-coach/references/methods/custom.md`：

````markdown
# 自定义方法（custom）

学习者在设置卡的自定义框里写了自己的方法，存在 `customMethod`。
**这一份只给护栏，具体步骤以 `customMethod` 的描述为准。**

## 这一节怎么做

1. 逐字读 `customMethod`，拆成"先做什么、再做什么、怎么算达标"三段。
2. 拆不出来（只写了一个名字，如"番茄工作法"）→ 问一个问题："这个方法里，你希望我先让你做什么？"拿到答案再排清单。
3. 按他的描述给行动清单，然后一步步带。**不要偷偷换成费曼或别的内置方法。**
4. 他的描述与下面护栏冲突时以护栏为准，并用一句话说明为什么。

## 不变的护栏（任何方法都适用）

- 每轮只问一个问题，回复 ≤150 字，不先给答案。
- 卡壳追加进 `misconceptions`，只追加。
- 阶梯提示三级；给到答案则标 `gap`，不算达标。
- 达标 = 不看提示独立做出节点的 `mastery`。
- 一节一 session，收口写回并提醒开新会话。
- 长讲解写进讲义文件，聊天只留短指令。

## 他的方法要求"你先讲一遍"时

照做，但讲完必须让他不看资料复述或做 `mastery`——**听你讲不算达标**。
讲解写进讲义文件，聊天里只给一句"讲义写好了，在 <路径>，读完告诉我"。

## 别做

- 别改 `method` 或 `customMethod`，那是学习者在设置卡里的选择。
- 别因为他的方法没名字就替他归到某个内置 id。

## 写回

`status`、`minutesSpent`、`misconceptions` 追加。
````

- [ ] **Step 4: 跑测试确认全绿**

Run：`pnpm run test`
Expected: PASS —38 + 5 = 43 个测试全绿。链接可达性那条会检查 13 份 Markdown 里的全部相对链接（SKILL.md 4 条 + first-run 2 条 + materials 1 条 + spaced 2 条 + pomodoro 1 条 = 10 条，≥8）。

行数自查（每份都必须 ≤40）：feynman 22、recall 21、spaced 31、interleave 26、pomodoro 26、sq3r 25、cornell 21、custom 34。若你改了 prose，重跑测试而不是放宽上限。

- [ ] **Step 5: 提交**

```bash
git -C F:/work/dsh-skill/dsh-skill-learning-coach add skills/learning-coach/references/methods tests/methods.test.mjs
git -C F:/work/dsh-skill/dsh-skill-learning-coach commit -m "feat: 八份方法卡，按方法分片按需读取"
```

---

### Task 9: 构建、打包自检、README 与交付检查点

**Files:**
- Modify: `README.md`（整份重写为 v2）
- Modify: `package.json`（只加一条 `pack:check` 脚本）
- Create: `scripts/check-package.mjs`
- Verify only: `lib/`、`cordis.patch.yml`、`skills/`、`tests/`

**Interfaces:**
- Consumes: Task 1–8 的全部产物。`scripts/check-package.mjs` 断言 tarball 里有 13 份 skill Markdown、8 份方法卡、`lib/index.js` / `lib/client.js` / `lib/shared/framework.js` 与对应 `.d.ts`。
- Produces: 可安装的 `dsh-skill-learning-coach-0.2.0.tgz`、给用户的安装/回滚命令与 spec §11 的 12 条走查清单。

- [ ] **Step 1: 先保住工作区里悬着的 v1 README 改动**

写本计划时 `git status --short` 显示 `M README.md`（v1 收尾时改的特性表与安装方式，还没提交）。**直接重写会丢掉它。**

Run：`git -C F:/work/dsh-skill/dsh-skill-learning-coach status --short`

- 若仍有 `M README.md`：先 `git -C F:/work/dsh-skill/dsh-skill-learning-coach diff README.md` 看清内容，确认是 v1 文档收尾（不是用户别的工作），然后单独提交：

```bash
git -C F:/work/dsh-skill/dsh-skill-learning-coach add README.md
git -C F:/work/dsh-skill/dsh-skill-learning-coach commit -m "docs: 补完 v1 README 的特性表与安装方式"
```

- 若工作区干净：跳过本步。
- 若 diff 里出现你不认识的内容：**停下来问用户**，不要提交也不要覆盖。

- [ ] **Step 2: 整份重写 `README.md`**

`````markdown
# dsh-skill-learning-coach · DSH 贴身学习教师

一个记得你卡在哪、按你的目的定达标标准、并且真的带你练的学习插件。
路线框架与学习方法在 DSH 原生设置卡里可视化编辑，改动落盘到工作区，下次会话 AI 读得到。

## 三块，各自职责单一

| 块 | 位置 | 干什么 |
| --- | --- | --- |
| 设置卡 | 设置 → 内置插件 → 学习路线 | 改目的与每周真实时间；路线树增 / 删 / 选为当前 / 标没懂；编辑每节的资料与达标标准；8 张学习方法卡单选 + 自定义 |
| host 半 | `lib/index.js` | 一条 fenced 路由 `/learning-coach/api`，两个方法 `state.read` / `state.write`；工作区路径由 host 从会话解析，客户端只传 `sessionId` |
| skill bundle | `skills/learning-coach/` | 38 行的路由 `SKILL.md` + 按需读的 `references/`；AI 每轮只读当前节点 |

渲染全在客户端，AI 零 output token。状态真源只有磁盘上那一个 JSON 文件，设置卡不存 localStorage。

## 状态与产物

- `<工作区>/learning/framework.json` —— 唯一状态源：目的、每周分钟数、方法、当前节、整棵框架树
- `<工作区>/learning/讲义/<YYYY-MM-DD>-<节点标题>.md` —— 一次一页，禁止批量生成

每个节点带三件东西：`materials`（资料 + 读到什么程度算够）、`mastery`（一件可验证的动作）、`misconceptions`（卡壳档案，只追加）。
卡壳档案下次会话必须被引用——这是"贴身"的物理载体，不是装饰。

## 学习方法（8 张卡）

费曼技巧 / 主动回忆 / 间隔重复 / 交错练习 / 番茄钟 + 刻意练习 / SQ3R 精读 / 康奈尔笔记 / 自定义。

方法库随包写死、按方法分片，选哪个 AI 才读哪个。自定义卡填自己的方法，AI 按其描述执行。
间隔重复的复习日由 AI 按固定表算（达标当日 +1 / +3 / +7 / +14 / +30 天），没有调度器、不起后台进程。

## 安装

> `--profile` 按实际平台选：`desktop`（桌面版）或 `web`（浏览器版）。

### 方式 A：本地开发链接（改一次生效一次）

```sh
pnpm dsh plugin --profile desktop add link:F:/work/dsh-skill/dsh-skill-learning-coach
```

### 方式 B：从 tarball 安装

```sh
pnpm pack
pnpm dsh plugin --profile desktop add file:./dsh-skill-learning-coach-0.2.0.tgz
```

装完**重启 DSH**：host 半与客户端 bundle 要重启才加载。之后只改 `skills/` 里的 Markdown 不必重启，每次加载都重读文件。

设置卡需要插件安装才出现。只把 `skills/` 复制到 `~/.dsh/skills/` 不会有设置卡，也不会有落盘路由——v2 不再支持那种零代码走法。

### 卸载 / 回滚

```sh
pnpm dsh plugin --profile desktop remove dsh-skill-learning-coach
```

要退回 v1：把仓库切到 v2 之前的提交 `85f4bbc`，再重新执行方式 A。
工作区里的 `learning/framework.json` 与讲义不会被卸载删除，需要时自己删。

## 使用

第一次说「我想学 X」。它会先问**目的**（工作 / 考试 / 兴趣 / 转行 + 期限 + 目标岗位或考试名），
再问现状（要具体动作）、过去一周真花了多少分钟、手上有什么资料，然后生成知识框架、沿框架一块一块问。
**问完默认你已懂**；你说没懂，它只标红那一个节点。

之后每次说「继续学」。它只读当前节点，先引用你上次的卡壳，给行动清单，再按你选的方法引导陪练：
你先做 → 卡壳给阶梯提示（方向 → 半个步骤 → 答案）→ 撤掉提示让你独立产出那件 `mastery`。
**给到答案就不算达标**，那一节标 `gap` 要重学。

一节收口时报三件事（路线在哪 / 这页讲义在哪 / 下一节第一个动作），并提醒你开新会话——状态在盘上，断了能续。

## 真机走查清单

逐条打勾。任何一条不过就停下来报给开发者，不要将就。

- [ ] 1 设置卡里增 / 删 / 选 / 标没懂后，`<工作区>/learning/framework.json` 立刻出现对应改动
- [ ] 2 新开会话说"继续学"，AI 第一动作是读该文件，且只读当前节点，不复述整张图
- [ ] 3 首次引导第一问是目的；目的不同（工作 vs 考试）时路径与达标动作形态确实不同
- [ ] 4 每节点都有 `materials`（含 enough）与 `mastery`；`mastery` 是可验证动作，不是"读完某章"
- [ ] 5 选费曼后 AI 先让你讲、挑卡壳、写进 `misconceptions`；下次会话能引用上次卡壳
- [ ] 6 卡壳时给阶梯提示；给到答案则该节点标 `gap`，不算达标
- [ ] 7 要求"把整门课讲义都写出来"被拒绝并解释，只交当前一节
- [ ] 8 每节收口报三件事并提醒开新会话
- [ ] 9 8 张方法卡都能选，自定义卡填内容后 AI 按其描述执行
- [ ] 10 包内无 HTML 模板、无本地服务脚本；`pnpm run build` 通过；`pnpm pack` 内容清单含 lib/ 与 skills/ 全部文件
- [ ] 11 host 路由拒绝非会话工作区（安全用例，见下）
- [ ] 12 写盘为原子写；故意留半截 JSON 时读路由报明确错误而非静默兜底

### 第 11 条怎么验

设置卡的工作区下拉里选一个会话，改动落盘后确认文件出现在**那个会话的 cwd** 下，而不是别的目录。
路由只接受 `sessionId`，路径由 host 解析，所以客户端无法指定任意路径——下拉里没有的目录就写不进去。

### 第 12 条怎么验

手工把 `learning/framework.json` 截断成半截（例如删掉最后一个 `}`），再打开设置卡：
应当看到明确错误提示，而不是空白卡片或静默重置。修好文件后重新打开即恢复。

## 开发

```sh
pnpm install
pnpm run build               # tsc（host + 类型）+ tsdown（客户端单 bundle）
pnpm run typecheck
pnpm run test                # 构建后跑 node --test tests/
pnpm run test:client-bundle  # 纯度门：客户端 bundle 不得 import 非平台模块
pnpm pack
pnpm run pack:check          # tarball 内容清单自检
```

`src/shared/framework.ts` 零 import，host 与 client 共用；client 不得 import 任何 host 文件（会把 Node 内置拖进浏览器 bundle，纯度门会炸）。

## 它故意不做什么

- 错题本与掌握度打分
- 批量生成整套课程讲义
- 多学习者档案 / 账号体系
- 联网抓取付费或需登录的资料
- HTML 页面与本地服务：全部可视化收进原生设置卡

## 从 v1 升级

v1 的 `learning/00-路线.md` 不迁移、留着不动；v2 的路线真源是 `learning/framework.json`。
v1 的 `references/intake.md` 已删除，被 `first-run.md` 取代。
`````

- [ ] **Step 3: 加打包自检脚本**

`package.json` 的 `scripts` 里，在 `"test:client-bundle"` 那行之后插入一行（其余逐字不动）：

```json
    "pack:check": "node scripts/check-package.mjs",
```

创建 `scripts/check-package.mjs`：

```js
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const arg = process.argv[2]
const name = arg ?? readdirSync(ROOT).filter(entry => entry.endsWith('.tgz')).sort().at(-1)
assert.ok(name, '找不到 .tgz，先跑 pnpm pack')

const listing = execFileSync('tar', ['-tzf', resolve(ROOT, name)], { encoding: 'utf8' })
const entries = listing.split('\n').map(line => line.trim()).filter(line => line !== '').map(line => line.replace(/^package\//, ''))

const required = [
  'package.json',
  'cordis.patch.yml',
  'README.md',
  'LICENSE',
  'lib/index.js',
  'lib/client.js',
  'lib/shared/framework.js',
  'lib/types/index.d.ts',
  'lib/types/client/index.d.ts',
  'lib/types/shared/framework.d.ts',
  'skills/learning-coach/SKILL.md',
]
for (const path of required) assert.ok(entries.includes(path), `包内缺少 ${path}`)

const skillFiles = entries.filter(path => path.startsWith('skills/'))
assert.equal(skillFiles.length, 13, `skills/ 应有 13 份 Markdown，实际 ${skillFiles.length}：\n${skillFiles.join('\n')}`)
for (const path of skillFiles) assert.ok(path.endsWith('.md'), `skills/ 里出现非 Markdown 文件：${path}`)
assert.equal(skillFiles.filter(path => path.includes('/references/methods/')).length, 8, '方法卡必须是 8 份')
assert.equal(skillFiles.includes('skills/learning-coach/references/intake.md'), false, 'v1 的 intake.md 不该还在包里')

for (const path of entries) {
  assert.ok(!path.endsWith('.html'), `包内不得有 HTML 模板：${path}`)
  assert.ok(!path.includes('node_modules/'), `包内不得有 node_modules：${path}`)
  assert.ok(!path.endsWith('.tgz'), `包内不得套 tgz：${path}`)
  assert.ok(!path.endsWith('.map'), `包内不得有 sourcemap：${path}`)
}

console.log(`OK ${name}：${entries.length} 个文件，skills/ 13 份 Markdown，methods/ 8 份`)
```

- [ ] **Step 4: 全量验证**

Run（包根）：`pnpm run typecheck && pnpm run test && pnpm run test:client-bundle`
Expected: typecheck 无输出；43 个测试全绿；纯度门通过。

任何一条红就停下来修，**不要往下打包**。

- [ ] **Step 5: 打包并自检内容清单**

Run（包根，Git Bash）：

```bash
pnpm pack --pack-destination .
pnpm run pack:check
tar -tzf dsh-skill-learning-coach-0.2.0.tgz | sort
```

Expected: `pack:check` 打印 `OK dsh-skill-learning-coach-0.2.0.tgz：N 个文件，skills/ 13 份 Markdown，methods/ 8 份`；清单里能看到 `package/lib/client.js`、`package/lib/index.js`、`package/cordis.patch.yml` 与 13 份 skill Markdown。

`prepack` 会自动再跑一次 build + 纯度门，这是故意的。
包根那份 `dsh-skill-learning-coach-0.1.0.tgz` 是 v1 自检产物、已被 `.gitignore` 忽略；**要不要删由用户定，agent 不删**。

- [ ] **Step 6: 再验一次 patch 能被 loader 叠上**

重复 Task 1 Step 8 的命令（`--profile web --dump-config --patch <本包 cordis.patch.yml>`）。
Expected: `dsh-skill-learning-coach` 与 `skill-learning-coach-bundled` 两个 id 都还在 dump 里。
**不得**改用 `--profile desktop`，**不得**新建验证 profile，**不得**跑 `dsh plugin add`。

- [ ] **Step 7: 对着 spec §11 做一次静态自查**

能静态验的现在验，需真机的明确标"交用户"，写进提交说明：

| §11 | 静态证据 | 还需真机 |
| --- | --- | --- |
| 1 增删选标立刻落盘 | `SettingsCard.tsx` 的 `commit()` → `saveState` → host `writeState` | 是 |
| 2 只读当前节点 | `SKILL.md` §0.1 与 §1；`coach-loop.md` 开场 | 是 |
| 3 第一问是目的 | `tests/skill-bundle.test.mjs` 的六问断言 | 是（路径与达标形态真的不同） |
| 4 materials/mastery 齐全 | `framework.md` §3；`parseFramework` 校验 | 是（mastery 是可验证动作） |
| 5 卡壳被下次引用 | `coach-loop.md` §0.1；`assertAppendOnly` + `tests/state.test.mjs` | 是 |
| 6 阶梯提示 / 给答案标 gap | `tests/skill-coach.test.mjs` 第一条 | 是 |
| 7 拒绝批量讲义 | `SKILL.md` §3；`materials.md` §9 | 是 |
| 8 收口三件事 + 换会话 | `coach-loop.md` §6 | 是 |
| 9 八张卡都能选 | `tests/methods.test.mjs` 第一条；`METHOD_LABEL` 覆盖八个 id | 是 |
| 10 无 HTML / build / pack | `tests/skill-bundle.test.mjs` 第三条 + `pack:check` | 否，已验 |
| 11 拒绝非会话工作区 | `tests/session-cwd.test.mjs`；路径永不过线 | 是（确认落盘目录） |
| 12 原子写 / 半截 JSON 报错 | `tests/state.test.mjs` | 是（设置卡显示红字） |

- [ ] **Step 8: 提交**

```bash
git -C F:/work/dsh-skill/dsh-skill-learning-coach add README.md package.json scripts/check-package.mjs
git -C F:/work/dsh-skill/dsh-skill-learning-coach commit -m "docs: v2 形态说明、安装回滚命令与 12 条真机走查清单"
```

Run：`git -C F:/work/dsh-skill/dsh-skill-learning-coach status --short`
Expected: 干净（`lib/`、`node_modules/`、`*.tgz` 都被忽略）。

- [ ] **Step 9: 交给用户的交付检查点（agent 在此停下）**

把下面这段原样交给用户，然后**停**。装机与真机走查是他自己跑的（spec §12），不要代跑。

> v2 做完了：43 个测试全绿，`pnpm pack` 内容清单自检通过，包在 `F:/work/dsh-skill/dsh-skill-learning-coach/dsh-skill-learning-coach-0.2.0.tgz`。
>
> 装（desktop profile）：
> ```sh
> pnpm dsh plugin --profile desktop add link:F:/work/dsh-skill/dsh-skill-learning-coach
> ```
> 装完**重启 DSH**，然后去 设置 → 内置插件 → 学习路线。
>
> 回滚：
> ```sh
> pnpm dsh plugin --profile desktop remove dsh-skill-learning-coach
> ```
>
> 走查清单在 README.md 的「真机走查清单」，12 条逐条打勾。**第 1 条最关键**：在设置卡里改一下目的或加一个节点，看 `<当前会话工作区>/learning/framework.json` 是否立刻出现对应改动。这条过了，spec §10 那一环就算真打通了。
>
> 任何一条不过，把现象贴回来（设置卡上的红字原文 / 文件落在哪个目录 / AI 第一句说了什么），我按现象定位，不猜。

**若第 1 条不通**，spec §10 的两条退路要由用户拍板，agent 不要自己选：
1. 状态改存插件 config（`.volatile()` + **DSH 版 schemastery**），走 `settings.update` 落 profile patch，host 在会话开始时镜像到工作区。
2. 再不通：AI 用 fs 工具自己维护 `framework.json`，设置卡降级为只读显示。

---