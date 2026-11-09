# learning-coach v2 设计稿：贴身教师 + 可编辑路线框架

日期：2026-11-06（2026-11-08 修订：入口迁移，见 §13）
状态：已批准
前序：`2026-11-06-learning-coach-design.md`（v1，已实现并装机）

## 1 目标

把 v1 的"问四问 → 给路线 → 写一页讲义"升级成**一个记得你卡在哪、按你的目的定达标标准、并且真的带你练的贴身教师**。
路线框架与学习方法由学习者在 DSH 设置卡里可视化编辑，改动落盘到工作区，下次会话 AI 读得到。

## 2 为什么是这个形态

- DSH 的学习类 skill 是空位（v1 已核实）；v2 的差异化不是"内容更多"，而是**状态外置 + 无提示产出 + 目的驱动达标**。
- 可视化通道已核实：侧栏能渲染 HTML（`sandbox="allow-scripts"`），但用户日常用的 Super Code preset **没有** `ask_user_question`、也没有 `present` 工具，所以聊天内选项卡片与交付卡片都不可用。
- 设置卡 → 主机持久化的链路**已有第三方实证**：`dsh-better-sidebar` 的设置卡改动此刻就在 `~/.dsh/profiles/desktop/cordis.patch.yml:114-117`（`agentOpenTools: false`）。链路为：客户端调插件自有 remote 路由 → host `ctx.inject(['settings'])` → `settings.update(ns, patch)` → dsh-settings → dsh-config-editor 写进 profile patch。
- 主机端能拿到会话工作区：`dsh-better-sidebar/src/index.ts:218` 用 `ctx.get('workingDirectory')?.get(session) ?? session.header.cwd`。
- 用户自己的 `dsh-voice-announcer` 已有可抄的设置卡与构建管线（`src/client/SettingsCard.tsx`、tsc + tsdown、`dsh.client.inject`）。它的偏好是纯 localStorage、host 半为空，**这部分不能抄**——本包必须落盘让 host 侧的 agent 读到。

决定：**放弃 HTML + 本地服务方案**，全部可视化收进原生设置卡。理由：不需要浏览器、不需要后台进程、不需要踩 Windows 后台存活的坑，且渲染完全发生在客户端，AI 零 output token。

## 3 形态与边界

包名不变 `dsh-skill-learning-coach`，版本 `0.2.0`。形态从"零代码 skill 包"变为**客户端 + 主机插件 + skill bundle**（与 dsh-voice-announcer 同形态）。

v2 做：
- AI 自生成知识框架；沿框架提问；**问完默认已懂，学习者说没懂只标红该节点**
- 首次引导第一问问**目的**（工作 / 考试 / 兴趣 / 转行 + 期限 + 目标岗位或考试名），目的决定路径裁剪与达标动作形态
- 每节点带 `materials`（资料 + 读到什么程度算够）、`mastery`（一件可验证的动作）、`misconceptions`（卡壳档案）
- 设置卡：路线框架增 / 删 / 选为当前 / 标没懂；资料与达标标准可编辑；目的可改；学习方法卡片单选
- 选定方法后：先给**行动清单**，再**引导式陪练**（突破 v1"不做逐节讲解"的边界，这是用户明确要求）
- 一节一 session，收口写回状态并提醒开新会话

v2 不做（各自后续独立立项）：
- 错题本与掌握度打分
- 批量生成整套课程讲义（一次一页的禁令保留）
- 多学习者档案 / 账号体系
- 联网自动抓取付费或需登录的资料

## 4 架构：三块，各自职责单一

### 4.1 客户端设置卡（`src/client/`）

入口：**设置侧边栏一级页面「学习路线」**——注册进 `settings.section`（列表型 slot，与模型、通用等同一导航列表），不放进"内置插件"页内的 tab（修订依据见 §13）。三部分：
1. 顶部：工作区选择器 + 目的（kind / detail / deadline）与每周真实可投入分钟数，可改
2. 中部：路线框架树。节点可增、可删、可点选"从这开始学"、可点选标"没懂"；展开可编辑该节点的 `materials` 与 `mastery`
3. 底部：学习方法卡片单选（8 张，见 §7），含自定义输入框

每次改动立刻调 host 路由写盘；打开卡片时调读路由回填。**客户端不存 localStorage 作为真源**（避免与磁盘状态分叉）。

`settings.section` 条目带 `id`（`learning-coach`）/ `order`（30，可调）/ `label`（"学习路线"）；组件经 owner 注入收到 `close`。空态（无 framework.json）提供"去开会话"按钮调用 `close()`，让学习者直接落到聊天窗说"我想学 X"。

### 4.2 主机半（`src/index.ts`）
只做两件事：
- 注册插件自有 fenced remote 路由：`learning-coach/state.read`、`learning-coach/state.write`
- 读写 `<工作区>/learning/framework.json`

安全约束（必须写进实现）：
- **工作区路径由 host 从会话解析**（`workingDirectory` 服务 / `session.header.cwd`），不接受客户端传来的任意路径直接落盘。若客户端必须传 cwd，host 要校验它等于某个已知会话的工作区，否则拒绝。
- 写盘用原子写（临时文件 + rename），避免半截 JSON 被 agent 读到。
- 读到的 JSON 先按 schema 校验，非法则返回明确错误而不是静默兜底。
- 不重蹈 better-sidebar 的覆辙：它的 README:217 明确警告自 v0.23.0 起 fs 路由**不再做工作区包含性检查**，本包的路由必须做。

### 4.3 skill bundle（`skills/learning-coach/`）
DSH 只解析 `SKILL.md`；`references/` 由 agent 按需读。文件分工：
- `SKILL.md`：≤60 行，只写路由（何时读哪个文件）+ 每轮硬约束（§8）。这是每次会话的固定注入成本，必须短。
- `references/first-run.md`：无 framework.json 时的首次引导（问目的 → 现状 → 真实时间 → 生成框架 → 沿框架问 → 默认已懂 / 标缺口 → 写盘）
- `references/framework.md`：框架生成规则、节点粒度、状态机、依赖护栏
- `references/coach-loop.md`：行动清单 → 引导陪练 → 阶梯提示 → 无提示产出 → 收口写回 → 提醒换会话
- `references/materials.md`：单页讲义模板（沿用 v1，增补"达标动作按 purpose 变形"）
- `references/methods/*.md`：8 份，每份 ≤40 行，**选哪个才读哪个**

v1 的 `references/intake.md` 被 `first-run.md` 取代（四问扩成目的优先的引导），旧文件删除，不留兼容层。

## 5 数据模型：一个文件说了算

`<工作区>/learning/framework.json` 是唯一状态源。故意只用一个状态文件：文件越少，AI 每轮要读的越少。

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

字段约束：
- `purpose.kind` ∈ `job | exam | interest | career-switch`；`exam` 时 `detail` 必须含考试名，`job` 时含目标岗位
- `method` ∈ 8 个 id（§7）；选 `custom` 时 `customMethod` 必须非空
- `status` 状态机：`pending`（还没问）→ 问完默认 `assumed-known`；学习者说没懂 → `gap`；生成讲义 → `drafted`；无提示产出达标 → `done`
- `current` 的选取：学习者在设置卡点选的节点优先；未点选时 = 按框架顺序第一个既非 `assumed-known` 也非 `done` 的节点
- `mastery` 必须是**一件可验证的动作**，禁止"读完某章""理解某概念"这类不可验证表述
- `materials[].enough` 必须写清读到什么程度算够
- `misconceptions` 只追加、不由 AI 清空；这是"专属"的物理载体
- `reviewOn`：仅 `method: spaced` 时使用，ISO 日期或 null；由 AI 按 §7 的固定间隔表算，无调度器
- `lecture` 路径相对工作区

讲义落 `learning/讲义/<YYYY-MM-DD>-<节点标题>.md`。

资料从哪来（沿用 v1 分流）：学习者有资料 → 本地路径直接读、链接用 tool-web 的 fetch 读，按框架排先后并写清 `enough`；没有资料 → 用 tool-web 的 search + fetch 找 2–3 个一手来源（官方文档、规范、教材章节优先），写进 `materials` 并附 URL 与访问日期；找不到就直说找不到，不用"网上有很多教程"糊过去。

与 v1 文件的关系：v2 不再写 `learning/00-路线.md`，路线真源改为 `framework.json`。v1 已生成的旧文件留着不动，**不做迁移、不留兼容层**。

## 6 流程

### 6.1 首次（无 framework.json）
1. 第一问目的：为了工作、考试、兴趣还是转行？期限？目标岗位或考试名？
2. 问现状：现在能独立做到哪（要具体动作，不要"了解"）
3. 问时间：**过去一周真花了多少分钟**，不按理想计划
4. AI 生成知识框架：按目的裁剪路径与顺序，节点粒度控制在**一节 15–25 分钟能收口**
5. 沿框架一块一块问，每轮只问一个问题；**问完默认已懂**，学习者说没懂则只标红该节点
6. 写 framework.json，给当前节的行动清单

### 6.2 回访（已有 framework.json）
只读当前节点（不读整张图）→ 行动清单 → 按选定方法引导陪练 → 无提示产出 → 收口写回 → 提醒开新会话学下一节。

### 6.3 陪练（以费曼为例）
AI 先让学习者讲（"当我是不懂的新人"）→ 挑卡壳与黑话 → 卡壳写进 `misconceptions` → 阶梯提示 → 学习者重讲 → 达标则 `status: done`。

阶梯提示三级：先给方向 → 再给半个步骤 → 最后才给答案，**给到答案则该节点标 `gap`（需重学）**，不算达标。

### 6.4 依赖护栏
生成某节时发现它依赖一个 `gap` 节点 → **只补那一节**，补完回来继续，不重跑整张图。

## 7 学习方法库（8 张卡）

八张卡，id 与核心动作：

1. `feynman` 费曼技巧——讲给新人听 → 找卡壳 → 简化重讲
2. `recall` 主动回忆——合上资料先答，再对照补漏
3. `spaced` 间隔重复——按遗忘曲线排复习日
4. `interleave` 交错练习——相邻主题混着练，不刷同一类题
5. `pomodoro` 番茄钟 + 刻意练习——25 分钟一块，只练最弱那一点
6. `sq3r` SQ3R 精读法——浏览-提问-读-复述-复习，啃官方文档
7. `cornell` 康奈尔笔记——线索栏 / 笔记栏 / 总结栏
8. `custom` 自定义——学习者填自己的方法，AI 按其描述执行

方法库内容随包写死（省 token）；每张卡上"落到你这一节怎么做"由 AI 补一句。
`spaced` 的复习日期由 AI 按固定间隔表算：达标当日 +1 / +3 / +7 / +14 / +30 天，写进 `reviewOn`；不引入调度器、不起后台进程。

## 8 省 token 的硬约束（写进 SKILL.md 正文，每轮生效）

1. 渲染全在客户端，AI 不生成 HTML、不生成图表
2. 只读当前节点，不读整张框架图；不重读已读过的 reference
3. 方法库按方法分片，选哪个读哪个
4. 长讲解写进讲义文件，聊天只留短指令（聊天里的长文会被后续每轮重放，文件只在被读时花一次）
5. 每轮只问一个问题、回复 ≤150 字、不复述学习者原话、不重复讲已讲过的原理、不先给答案
6. 一节一 session；收口时提醒开新会话（状态在盘上，断了能续）
7. `SKILL.md` 正文 ≤60 行，frontmatter `description` ≤80 字

## 9 教学法原则（实现时必须遵守，不是装饰）

- **专属 = 卡壳档案**：`misconceptions` 必须被下次会话引用，否则"贴身"是假的
- **学懂 = 无提示产出**：AI 不替学习者总结
- **能实践 = 达标动作是真场景里的一件小事**，形态由 `purpose` 决定（工作 → 能跑的东西 / 能在评审里讲清；考试 → 限时答对真题）
- **少讲多问**：省 token 与教学法在此是同一件事
- **每节小到 15–25 分钟能收口**：无提示产出更累，节太大就会放弃

## 10 唯一未打通的环（实施计划 Task 1）

**设置卡是全局界面，它能否拿到"当前会话的工作区路径"**——这决定 json 写进哪个项目。better-sidebar 的客户端会传 cwd，但设置卡有没有这个上下文未验证。

Task 1 = 最小验证：一张只含"读状态 / 写状态"两个按钮的设置卡 + 两条 host 路由，真跑一次，看文件落在哪、能否跨会话读到。**通了再往下填内容。**

不通时的退路（按优先级）：
1. 状态存插件 config（字段标 `.volatile()`，必须用 **DSH 版 schemastery**，公开版会静默失效），走 `settings.update` 落 profile patch；host 在会话开始时镜像到工作区
2. 再不通：AI 用 fs 工具自己维护 framework.json，设置卡只做只读显示（降级但仍可用）

## 11 验收标准（逐条可验）

1. 设置卡里增 / 删 / 选 / 标没懂后，`<工作区>/learning/framework.json` 立刻出现对应改动
2. 新开会话说"继续学"，AI 第一动作是读该文件，且只读当前节点，不复述整张图
3. 首次引导第一问是目的；目的不同（工作 vs 考试）时路径与达标动作形态确实不同
4. 每节点都有 `materials`（含 enough）与 `mastery`；`mastery` 是可验证动作，不是"读完某章"
5. 选费曼后 AI 先让学习者讲、挑卡壳、写进 `misconceptions`；**下次会话能引用上次卡壳**
6. 卡壳时给阶梯提示；给到答案则该节点标 `gap`，不算达标
7. 要求"把整门课讲义都写出来"被拒绝并解释，只交当前一节
8. 每节收口报三件事（路线在哪 / 这页在哪 / 下一节第一个动作）并提醒开新会话
9. 8 张方法卡都能选，自定义卡填内容后 AI 按其描述执行
10. 包内无 HTML 模板、无本地服务脚本；`pnpm run build` 通过；`pnpm pack` 内容清单含 lib/ 与 skills/ 全部文件
11. host 路由拒绝客户端传来的非会话工作区路径（安全用例）
12. 写盘为原子写；故意留半截 JSON 时读路由报明确错误而非静默兜底
13. 设置侧边栏存在一级页面「学习路线」（与模型等并列）；「内置插件」设置页内不再出现同名 tab

## 12 安装与验证分工

沿用 v1 约定：**agent 只把包做完，装机与真机走查由用户自己跑**（用户已明确"你先做好 skill 然后我自己装"；本次他贴命令授权过一次 link 安装，不构成长期授权）。
交付物：安装命令 + 回滚命令 + 逐条可打勾的走查清单（§11）。

## 13 修订记录

### 2026-11-08：入口从"内置插件 tab"迁到设置侧边栏一级页面

- 事实：v2 实施计划 Task 1 已按原设计把设置卡注册进 `settings.plugins.tab`（"设置 → 内置插件 → 学习路线"）。用户真机看到后要求：插件要在设置侧边栏直接可见，与模型等一个位置；且学习路线必须可视化，不能暴露 JSON。
- 决定：注册目标改为 `settings.section`——设置域基座包（`@deepseek-ai/dsh-client-ui-settings`）声明的一级页面列表 slot，模型页（ui-settings-models）等即注册于此，与模型同在侧边栏导航列表。
- 否决的备选：`settings.general.item`（通用区偏好行）放不下路线编辑器；`settings.section` + `settings.plugins.tab` 双注册会造成两个入口、令人猜测数据是否同一份，且"内置插件"里残留同名 tab。
- 影响面：`src/client/index.ts` 改注册目标（`id: learning-coach` / `order: 30` / `label: "学习路线"`）并删除 plugins.tab 注册；`SettingsCard` props 增加 owner 注入的 `close`，空态新增"去开会话"按钮。host 半、数据模型、skill 半均不变。
- 顺序的如实说明：侧边栏各页先后由 `order` 数值决定；宿主安装内其它页面（含模型）的 order 值本仓库不可见，故只保证"同在侧边栏一级列表"，不保证紧邻模型；`order: 30` 后续可一行调整。
- 状态：本次修订随"完整 v2"实施一并落地（实施计划 Task 4 同步 amend）。

### 2026-11-09：学习页从"AI 现写原理"改为"编排已有资料"

- 事实：v2 的自标行写的是"本页为 AI 现写的辅助讲义"。用户在读完 README 后指出：学一个东西时，现有资料他可以提供，或可从网络搜索获取，这样更省 token，也更贴合他自己的语境。
- 决定：学习页改为**资料索引 + 练习页**。有 `materials` 一手来源时只写：读哪几段（`locator`）、读到什么算够（`enough`）、三道自测、达标动作；不重写原理。无任何一手来源才允许现写"原理速览"，页首标「待核实」并写出至少两处待核实点。正文预算 300 字。
- 模型改动：`materials[]` 增可选 `locator`（章节号 / 页码 / 时间戳 / 段落首句），`parseMaterial` 显式解析——`parseFramework` 会静默丢弃未知字段，不解析就会写盘即丢。
- 理由（为什么不是全盘生成，也不是全盘搬运）：找资料是输入，写讲义是输出，输出才是贵的那一头；但纯搬运会让学习者"读完就忘"，所以自测与无提示产出必须保留。
- 已知代价：资料质量决定页面质量，一手来源优先级不能松；联网 fetch 本身也耗 token，只是比生成便宜，本地文件最便宜。
- 影响面：`skills/learning-coach/references/materials.md` 整份重写、`SKILL.md` 增第 7 条硬约束、`first-run.md` 问 4 改为"先翻手上的再上网"、`framework.md` 要求有来源就写 `locator`、`src/shared/framework.ts` 加字段、测试增两条并改三条断言。版本 `0.2.2`。

### 2026-11-09：引导改成选项式，路线图落成离线 HTML

- 事实：用户真机走查后提两条：① 首次了解信息时应给选项，更能引导操作；② 整理完信息后应"通过 html 展示学习路线"，并且设置内要实时更新。
- 决定一（引导）：六问全部改成编号选项 + 一句推荐；现状一问分四档；仍保留"追问一个具体动作"的要求。理由：开放式追问每轮都要用户组织语言，"回数字"的完成率高得多。
- 决定二（路线图）：新增 `learning/路线图.html`，由 AI 照 `skills/learning-coach/references/roadmap-template.html` 填充占位符生成，纯离线单文件（无外链、无脚本）。这是对原"不生成 HTML"的修订——原意是禁止 AI 在聊天里自创版式与贴图，不是禁止可视化产物；模板化后版式唯一、数据与 `framework.json` 同源。
- 决定三（实时）：`SettingsCard` 每 3 秒 `state.read` 比对一次，变了才替换 draft；`document.activeElement` 在输入框里或上次保存失败时跳过本轮。没有做文件监听（跨平台与网络盘不可靠），用轮询换确定性。
- 否决的备选：host 侧在 `state.write` 里顺带写 HTML——AI 是直接用 fs 写 `framework.json` 的，不走 host 路由，这条路盖不住首次落盘；另加 `state.render` 接口会让"谁能写 HTML"出现两个入口。
- 已知代价：HTML 是快照，改完要重开页面；轮询有最多 3 秒延迟，且多窗口同改时后写覆盖先写（与原来 `state.write` 的行为一致，没有变差）。
- 版本 `0.2.3`。
