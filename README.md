# dsh-skill-learning-coach

**一个记得你卡在哪的 DSH 学习陪练。** 路线在设置卡里改，进度在盘上，学没学会由你的产出说了算。

[![npm version](https://img.shields.io/npm/v/dsh-skill-learning-coach.svg)](https://www.npmjs.com/package/dsh-skill-learning-coach)
[![npm downloads](https://img.shields.io/npm/dm/dsh-skill-learning-coach.svg)](https://www.npmjs.com/package/dsh-skill-learning-coach)
[![CI](https://github.com/wanlte/dsh-skill-learning-coach/actions/workflows/ci.yml/badge.svg)](https://github.com/wanlte/dsh-skill-learning-coach/actions/workflows/ci.yml)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

学习类 AI 工具大多停在"给你一份看起来很完整的计划"。第二次对话，它忘了你学到哪；第八次对话，它还在讲第一章。
这个包把状态从聊天记录里搬到磁盘上，把"学会了"从 AI 的一句夸奖换成一件你不看资料也能做出来的事。

- **状态外置**：`<工作区>/learning/framework.json` 是唯一真源。换会话、换模型、断了重连，都从同一处续。
- **无提示产出才算过**：AI 先撤掉提示，你自己做。给到答案就标 `gap`，这一节重学。
- **卡壳档案只追加**：你上次误解的那一点，下次开场它先提。这是"贴身"的物理载体，不是装饰。
- **按目的定达标**：工作 / 考试 / 兴趣 / 转行，达标动作的形态不同——能跑的东西，还是一道限时真题。

> 状态：`0.2.1`。`tsc` 无错、43 项自动测试全绿、打包清单自检通过；下面 13 条真机项需要在装机的机器上复核。

## 装

```sh
# 桌面版 / 网页版，按平台换 --profile
pnpm dsh plugin --profile desktop add dsh-skill-learning-coach
pnpm dsh plugin --profile web     add dsh-skill-learning-coach

# 没有本地 dsh 命令时
npx @deepseek-ai/dsh plugin add dsh-skill-learning-coach
```

改包想立刻看到效果，用本地链接（改一次生效一次）：

```sh
pnpm dsh plugin --profile desktop add link:F:/work/dsh-skill/dsh-skill-learning-coach
```

装完**重启 DSH**：host 半与客户端 bundle 要重启才加载。之后只改 `skills/` 里的 Markdown 不必重启。
设置里侧边栏一级会多一项「学习路线」，与「模型」同列；没有这一项就说明没装上。

也能直接从 GitHub 装（仓库公开，无需登录）：

```sh
pnpm dsh plugin --profile desktop add github:wanlte/dsh-skill-learning-coach
```

代价有三个，都是在装的人那边付：pnpm 默认拒绝执行 git 依赖的构建脚本（不放行就 `ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED`，要在 `pnpm-workspace.yaml` 的 `allowBuilds` 里加这个包）；装完包内 skill 会被标成 "awaiting approval"，要 `pnpm approve` 放行；以及本地要从源码构建一次（约 40 秒），依赖 GitHub 可达与完整 Node 工具链。npm 那条是预构建 tarball，不跑脚本、几秒钟。

卸载 / 回滚：

```sh
pnpm dsh plugin --profile desktop remove dsh-skill-learning-coach
```

工作区里的 `learning/framework.json` 与讲义不会被卸载删除，需要时自己删。

## 用

**第一次**：说「我想学 X」。它先问**目的**（工作 / 考试 / 兴趣 / 转行，加期限与目标岗位或考试名），再问现状（要具体动作，不要"了解"）、过去一周真花了多少分钟、手上有什么资料。然后生成知识框架，沿框架一块一块问。
**问完默认你已懂**；你说没懂，它只标红那一个节点。

**之后每次**：说「继续学」。它只读当前节点，先引用你上次的卡壳，给行动清单，再按你选的方法带练：
你先做 → 卡壳给阶梯提示（方向 → 半个步骤 → 答案）→ 撤掉提示，让你独立产出那件 `mastery`。

**一节收口**：报三件事（路线在哪 / 这页讲义在哪 / 下一节第一个动作），并提醒开新会话。状态在盘上，断了能续。

## 和"AI 家教"哪里不一样

| | 常见 AI 家教 | 这个包 |
| --- | --- | --- |
| 学习状态 | 在聊天上下文里，换会话即失忆 | 一个 JSON 文件，host 路由读写，换会话照读 |
| 路线 | AI 生成完就冻结，改不了 | 设置卡里增 / 删 / 选为当前 / 标没懂，改完立刻落盘 |
| 学过没有 | AI 复述一遍就算过 | 撤掉提示后的独立产出，才算 `done` |
| 卡壳 | 当轮聊完就丢 | `misconceptions` 只追加，下次开场必须引用 |
| 达标标准 | "理解 XX" | 一件可验证的动作，形态随 `purpose` 变 |
| token | 每轮重放整段对话里的计划 | 每轮只读当前节点 + 当前那一份方法卡 |

## 形态：三块，职责单一

| 块 | 位置 | 干什么 |
| --- | --- | --- |
| 设置卡 | 设置 → 学习路线（侧边栏一级） | 改目的与每周真实时间；路线树增 / 删 / 选为当前 / 标没懂；编辑每节的资料与达标标准；8 张学习方法卡单选 + 自定义 |
| host 半 | `lib/index.js` | 一条 fenced 路由 `/learning-coach/api`，两个方法 `state.read` / `state.write`；工作区路径由 host 从会话解析，客户端只传 `sessionId` |
| skill bundle | `skills/learning-coach/` | 38 行路由 `SKILL.md` + 按需读的 `references/`；AI 每轮只读当前节点 |

渲染全在客户端，AI 零 output token。设置卡不存 localStorage，状态真源只有磁盘上那一个 JSON。
"内置插件"设置页里没有同名 tab——只有侧边栏这一个入口。

## 状态与产物

- `<工作区>/learning/framework.json` —— 唯一状态源：目的、每周分钟数、方法、当前节、整棵框架树
- `<工作区>/learning/讲义/<YYYY-MM-DD>-<节点标题>.md` —— 一次一页，禁止批量生成

```json
{
  "version": 1,
  "topic": "计算机网络",
  "purpose": { "kind": "job", "detail": "后端求职面试", "deadline": "2026-12-20" },
  "weeklyMinutes": 420,
  "method": "feynman",
  "customMethod": null,
  "current": "3.2",
  "nodes": [
    {
      "id": "3.2",
      "parent": "3",
      "title": "TCP 三次握手",
      "status": "gap",
      "materials": [
        { "kind": "url", "ref": "https://www.rfc-editor.org/rfc/rfc9293", "enough": "能画出三段报文交换图" }
      ],
      "mastery": "不看资料，向新人讲清为什么不是两次，并说出第三次握手防的是什么",
      "misconceptions": ["把'确认收到'当成第三次握手的唯一目的"],
      "reviewOn": null,
      "lecture": "learning/讲义/2026-11-06-TCP三次握手.md",
      "minutesSpent": 0
    }
  ]
}
```

字段守则：

- `status` 状态机：`pending` → 问完 `assumed-known` → 说没懂 `gap` → 出讲义 `drafted` → 无提示产出 `done`
- `mastery` 必须是一件可验证的动作；"读完某章""理解某概念"不许落盘
- `materials[].enough` 必须写清读到什么程度算够
- `misconceptions` 只追加、不由 AI 清空；写盘时被改写直接拒写
- 写盘走原子写（先 `.tmp` 再 rename）；半截 JSON 读出来报明确错误，不静默重置

## 学习方法（8 张卡）

费曼技巧 / 主动回忆 / 间隔重复 / 交错练习 / 番茄钟 + 刻意练习 / SQ3R 精读 / 康奈尔笔记 / 自定义。

方法库随包写死、按方法分片，选哪个 AI 才读哪个。自定义卡填自己的方法，AI 按其描述执行。
间隔重复的复习日由 AI 按固定表算（达标当日 +1 / +3 / +7 / +14 / +30 天），没有调度器、不起后台进程。

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
- [ ] 13 设置侧边栏一级能看到「学习路线」，与「模型」同一列表；「内置插件」页内没有同名 tab

### 第 11 条怎么验

设置卡的工作区下拉里选一个会话，改动落盘后确认文件出现在**那个会话的 cwd** 下，而不是别的目录。
路由只接受 `sessionId`，路径由 host 解析，所以客户端无法指定任意路径——下拉里没有的目录就写不进去。

### 第 12 条怎么验

手工把 `learning/framework.json` 截断成半截（例如删掉最后一个 `}`），再打开设置卡：
应当看到明确错误提示，而不是空白卡片或静默重置。修好文件后重新打开即恢复。

### 第 13 条怎么验

打开设置，侧边栏一级列表里找「学习路线」——它在，且点进去就是那张卡片。
再去「内置插件」页确认没有第二个同名入口（有两个入口会让人怀疑是不是两份数据）。

## 开发

```sh
pnpm install
pnpm run build               # tsc（host + 类型）+ tsdown（客户端单 bundle）
pnpm run typecheck
pnpm run test                # 构建后跑 node --test
pnpm run test:client-bundle  # 纯度门：客户端 bundle 不得 import 非平台模块
pnpm pack
pnpm run pack:check          # tarball 内容清单自检
```

`src/shared/framework.ts` 零 import，host 与 client 共用；client 不得 import 任何 host 文件（会把 Node 内置拖进浏览器 bundle，纯度门会炸）。

## 发布与生态收录

`dshai.org` / `dshmarket` 这类 registry 不人工收录，而是**自动**抓两处：GitHub 仓库的 `dsh-plugin` topic，与 npm 包上的 `dsh-plugin` 关键词。缺一个就搜不到。

本包已备好：`keywords` 含 `dsh-plugin`、`repository` / `homepage` / `bugs` 齐、`publishConfig` 锁定官方 registry、`files` 剔除了内部计划文档。
推上去的操作步骤、市场文案与验证方法见 [RELEASING.md](https://github.com/wanlte/dsh-skill-learning-coach/blob/main/RELEASING.md)。
一条命令跑完所有门：`pwsh scripts/release.ps1`，加 `-Publish` 才真发。
版本变更见 [CHANGELOG.md](https://github.com/wanlte/dsh-skill-learning-coach/blob/main/CHANGELOG.md)。

## 它故意不做什么

- 错题本与掌握度打分
- 批量生成整套课程讲义
- 多学习者档案 / 账号体系
- 联网抓取付费或需登录的资料
- HTML 页面与本地服务：全部可视化收进原生设置卡

## English

A DSH plugin that remembers where you got stuck. Roadmap and learning method are edited in a native settings card and persisted to the workspace; "learned" means an unprompted reproduction, not a compliment from the model.

Install: `pnpm dsh plugin --profile desktop add dsh-skill-learning-coach`, restart DSH, then open Settings → 学习路线.
Full English guide: [README.en.md](README.en.md).

## License

MIT © wanlte
