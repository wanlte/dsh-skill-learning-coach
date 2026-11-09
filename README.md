# dsh-skill-learning-coach

**一个记得你卡在哪的 DSH 学习陪练。** 路线在设置卡里改，进度在盘上，学没学会由你的产出说了算。

[![npm version](https://img.shields.io/npm/v/dsh-skill-learning-coach.svg)](https://www.npmjs.com/package/dsh-skill-learning-coach)
[![npm downloads](https://img.shields.io/npm/dm/dsh-skill-learning-coach.svg)](https://www.npmjs.com/package/dsh-skill-learning-coach)
[![CI](https://github.com/wanlte/dsh-skill-learning-coach/actions/workflows/ci.yml/badge.svg)](https://github.com/wanlte/dsh-skill-learning-coach/actions/workflows/ci.yml)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## 它是什么

DSH（DeepSeek Harness）的一个插件，由三块拼成：一张原生设置卡用来改学习路线与学习方法；一个 host 半把状态读写到当前会话的工作区；一个 skill bundle 让 AI 按你的真实进度带练。装好之后，你只需要说「我想学 X」或「继续学」。

适合：有明确目标（求职面试、考试、转行、兴趣）但总在「看完就忘」的人。
不适合：想要一份静态学习计划的人，或者想让 AI 直接把整门课讲完的人。

学习类 AI 工具大多停在「给你一份看起来很完整的计划」。第二次对话，它忘了你学到哪；第八次对话，它还在讲第一章。
这个包把状态从聊天记录里搬到磁盘上，把「学会了」从 AI 的一句夸奖换成一件你不看资料也能做出来的事。

## 它解决什么

- **状态外置**：`<工作区>/learning/framework.json` 是唯一真源。换会话、换模型、断了重连，都从同一处续。
- **无提示产出才算过**：AI 先撤掉提示，你自己做。给到答案就标 `gap`，这一节重学。
- **卡壳档案只追加**：你上次误解的那一点，下次开场它先提。这是「贴身」的物理载体，不是装饰。
- **按目的定达标**：工作 / 考试 / 兴趣 / 转行，达标动作的形态不同——能跑的东西，还是一道限时真题。
- **资料优先，不重写教材**：你手上的教材、课件、链接先读；学习页只写「读哪几段、读到什么算够、自测、达标动作」，原理归来源。省 token，也更贴你的语境。
- **节小到能收口**：一节 15–25 分钟，无提示产出更累，节太大就会放弃。

## 和「AI 家教」哪里不一样

| | 常见 AI 家教 | 这个包 |
| --- | --- | --- |
| 学习状态 | 在聊天上下文里，换会话即失忆 | 一个 JSON 文件，host 路由读写，换会话照读 |
| 路线 | AI 生成完就冻结，改不了 | 设置卡里增 / 删 / 选为当前 / 标没懂，改完立刻落盘 |
| 学过没有 | AI 复述一遍就算过 | 撤掉提示后的独立产出，才算 `done` |
| 卡壳 | 当轮聊完就丢 | `misconceptions` 只追加，下次开场必须引用 |
| 达标标准 | 「理解 XX」 | 一件可验证的动作，形态随 `purpose` 变 |
| 讲义 | AI 重写一遍教材，贵且容易错 | 你手上的资料先读，学习页只做定位 + 自测，原理归来源 |
| token | 每轮重放整段对话里的计划 | 每轮只读当前节点 + 当前那一份方法卡 |

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

仓库公开，也能 `github:wanlte/dsh-skill-learning-coach` 直装；代价是装的人那边要放行构建脚本并本地构建一次，日常用 npm 那条更快。

装完**重启 DSH**：host 半与客户端 bundle 要重启才加载。之后只改 `skills/` 里的 Markdown 不必重启。
设置里侧边栏一级会多一项「学习路线」，与「模型」同列；没有这一项就说明没装上。

卸载：

```sh
pnpm dsh plugin --profile desktop remove dsh-skill-learning-coach
```

工作区里的 `learning/framework.json` 与讲义不会被卸载删除，需要时自己删。

## 用

**第一次**：说「我想学 X」。它先问**目的**（工作 / 考试 / 兴趣 / 转行，加期限与目标岗位或考试名），再问现状（要具体动作，不要「了解」）、过去一周真花了多少分钟、手上有什么资料。然后生成知识框架，沿框架一块一块问。
**问完默认你已懂**；你说没懂，它只标红那一个节点。

**之后每次**：说「继续学」。它只读当前节点，先引用你上次的卡壳，给行动清单，再按你选的方法带练：
你先做 → 卡壳给阶梯提示（方向 → 半个步骤 → 答案）→ 撤掉提示，让你独立产出那件 `mastery`。

**一节收口**：报三件事（路线在哪 / 这页学习页在哪 / 下一节第一个动作），并提醒开新会话。状态在盘上，断了能续。

## 形态：三块，职责单一

| 块 | 位置 | 干什么 |
| --- | --- | --- |
| 设置卡 | 设置 → 学习路线（侧边栏一级） | 改目的与每周真实时间；路线树增 / 删 / 选为当前 / 标没懂；编辑每节的资料与达标标准；8 张学习方法卡单选 + 自定义 |
| host 半 | `lib/index.js` | 一条 fenced 路由 `/learning-coach/api`，两个方法 `state.read` / `state.write`；工作区路径由 host 从会话解析，客户端只传 `sessionId` |
| skill bundle | `skills/learning-coach/` | 38 行路由 `SKILL.md` + 按需读的 `references/`；AI 每轮只读当前节点 |

渲染全在客户端，AI 零 output token。设置卡不存 localStorage，状态真源只有磁盘上那一个 JSON。
「内置插件」设置页里没有同名 tab——只有侧边栏这一个入口。

## 状态与产物

- `<工作区>/learning/framework.json` —— 唯一状态源：目的、每周分钟数、方法、当前节、整棵框架树
- `<工作区>/learning/讲义/<YYYY-MM-DD>-<节点标题>.md` —— 一次一页，资料索引 + 自测，禁止批量生成

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
        {
          "kind": "url",
          "ref": "https://www.rfc-editor.org/rfc/rfc9293",
          "locator": "§3.4 TCP Connection Establishment",
          "enough": "读到 SYN / SYN-ACK / ACK 各改哪个状态就停"
        }
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

- `status` 状态机：`pending` → 问完 `assumed-known` → 说没懂 `gap` → 出学习页 `drafted` → 无提示产出 `done`
- `mastery` 必须是一件可验证的动作；「读完某章」「理解某概念」不许落盘
- `materials[].locator` 写到能一步翻到的粒度（章节 / 页码 / 时间戳 / 段落首句），是「只编排不重写」的前提
- `materials[].enough` 必须写清读到什么程度算够
- `misconceptions` 只追加、不由 AI 清空；写盘时被改写直接拒写
- 写盘走原子写（先 `.tmp` 再 rename）；半截 JSON 读出来报明确错误，不静默重置

## 学习方法（8 张卡）

费曼技巧 / 主动回忆 / 间隔重复 / 交错练习 / 番茄钟 + 刻意练习 / SQ3R 精读 / 康奈尔笔记 / 自定义。

方法库随包写死、按方法分片，选哪个 AI 才读哪个。自定义卡填自己的方法，AI 按其描述执行。
间隔重复的复习日由 AI 按固定表算（达标当日 +1 / +3 / +7 / +14 / +30 天），没有调度器、不起后台进程。

## 它故意不做什么

- 错题本与掌握度打分
- 批量生成整套课程讲义
- 多学习者档案 / 账号体系
- 联网抓取付费或需登录的资料
- HTML 页面与本地服务：全部可视化收进原生设置卡

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

版本变更见 [CHANGELOG.md](https://github.com/wanlte/dsh-skill-learning-coach/blob/main/CHANGELOG.md)。

## English

A DSH plugin that remembers where you got stuck. The roadmap and learning method are edited in a native settings card and persisted to the workspace; "learned" means an unprompted reproduction, not a compliment from the model.

Install: `pnpm dsh plugin --profile desktop add dsh-skill-learning-coach`, restart DSH, then open Settings → 学习路线.
Full English guide: [README.en.md](https://github.com/wanlte/dsh-skill-learning-coach/blob/main/README.en.md).

## License

MIT © wanlte
