# dsh-skill-learning-coach · DSH 贴身学习教师

一个记得你卡在哪、按你的目的定达标标准、并且真的带你练的学习插件。
路线框架与学习方法在 DSH 原生设置卡里可视化编辑，改动落盘到工作区，下次会话 AI 读得到。

## 三块，各自职责单一

| 块 | 位置 | 干什么 |
| --- | --- | --- |
| 设置卡 | 设置 → 学习路线（侧边栏一级，与「模型」同列） | 改目的与每周真实时间；路线树增 / 删 / 选为当前 / 标没懂；编辑每节的资料与达标标准；8 张学习方法卡单选 + 自定义 |
| host 半 | `lib/index.js` | 一条 fenced 路由 `/learning-coach/api`，两个方法 `state.read` / `state.write`；工作区路径由 host 从会话解析，客户端只传 `sessionId` |
| skill bundle | `skills/learning-coach/` | 38 行的路由 `SKILL.md` + 按需读的 `references/`；AI 每轮只读当前节点 |

渲染全在客户端，AI 零 output token。状态真源只有磁盘上那一个 JSON 文件，设置卡不存 localStorage。
「内置插件」设置页里不再出现同名 tab——v2 只有侧边栏这一个入口。

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

## 它故意不做什么

- 错题本与掌握度打分
- 批量生成整套课程讲义
- 多学习者档案 / 账号体系
- 联网抓取付费或需登录的资料
- HTML 页面与本地服务：全部可视化收进原生设置卡

## 从 v1 升级

v1 的 `learning/00-路线.md` 不迁移、留着不动；v2 的路线真源是 `learning/framework.json`。
v1 的 `references/intake.md` 已删除，被 `first-run.md` 取代。
