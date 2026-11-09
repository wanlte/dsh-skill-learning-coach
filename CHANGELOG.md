# 变更记录

版本遵循 [SemVer](https://semver.org/lang/zh-CN/)。本仓库此前只在本地与 link 安装使用，`0.2.1` 起准备发布到 npm。

## 0.2.3 — 2026-11-09

引导与展示改造：问的时候给选项，问完看得见路线图。

**引导**

- 首次引导六问全部改成编号选项（目的 / 现状 / 真实时间 / 资料 / 方法 / 确认切法），回一个数字就能往下走；选项里带推荐项，不选按推荐走。
- 现状一问分成四档（完全没接触 / 看过但写不出 / 能照例子做 / 能独立做但讲不清），仍要求补一个具体动作。

**路线图**

- 新增 `learning/路线图.html`：框架落盘后照 `references/roadmap-template.html` 渲染成离线单文件（进度条、状态标签、当前节点、每节达标动作与资料位置），断网可开，不引外链、不带脚本。
- 结构变化（增删节点、改目的或期限）时整份重生成；聊天里不贴 HTML、不画字符树，只给路径与当前节点编号。
- `SKILL.md` 接上 `references/roadmap.md` 路由；原来"不生成 HTML"改为"照模板生成，渲染收进设置卡与这页快照"。

**设置卡**

- 每 3 秒从盘上同步一次：AI 在会话里落盘、别处改了 JSON，卡片自己刷进来，不用重开设置。
- 正在输入或上次保存失败时暂停轮询，避免把手里没提交的文字冲掉。

**工程**

- `skills/` 只放行一个模板文件（`roadmap-template.html`），其余仍必须是 Markdown；打包闸门与测试同步计为 14 份 Markdown。

## 0.2.2 — 2026-11-09

教学法修正：学习页从「AI 现写原理」改成「编排已有资料」。

**行为**

- `materials[].locator` 新增为可选字段（章节号 / 页码 / 时间戳 / 段落首句），`parseMaterial` 显式解析。旧数据没有这个字段照常读，写盘往返不会凭空补键。
- skill 新增硬约束「有资料就只编排」：`materials` 里有一手来源时，学习页只写读哪几段、读到什么算够、自测题与达标动作，不重写原理。
- 学习页唯一的例外分支：一条一手来源都没有时才允许现写原理速览，页首必须标「待核实」并写出至少两处待核实点，收口约下次补来源。
- 设置卡资料行新增「位置」输入框（章节 / 页码 / 段落），可读可改；清空即从数据里去掉该键。
- 正文预算 300 字。超了说明又把教材重写了一遍。
- `first-run.md` 问 4 改成「先翻手上的，再上网」：本地文件 → 链接 → 联网搜；二手博客先找它引用的一手来源，找不到则标「仅二手来源」。

**文档**

- README / README.en 同步：新增「资料优先」对照行与字段守则，状态示例带 `locator`。
- `framework.md` 要求有来源就必须写 `locator`。

**测试**

- 新增 `locator` 往返与类型校验两条；`materials` 断言改为检查编排页结构与例外分支（不再要求「AI 现写」自标）。

## 0.2.1 — 2026-11-08

发布就绪版。运行时零改动，只动元数据、文档与工程门。

**可发现性**

- `keywords` 增加 `dsh-plugin` / `deepseek-harness` / `plugin` / `spaced-repetition` 等。DSH 生态 registry 只按 GitHub topic `dsh-plugin` 与 npm 同名 keyword 自动收录，缺一个就搜不到。
- 补 `repository` / `homepage` / `bugs` / `author`；`publishConfig` 固定 `registry.npmjs.org` 与 `access: public`，避免 `.npmrc` 指向镜像时发错地方。
- `files` 收敛：内部 SDD 计划、brief 与评审 diff 不再进 tarball；补 `README.en.md` 与 `CHANGELOG.md`。

**文档**

- README 重写为首屏能说服陌生人的版本：定位、差异化对照表、三块架构、状态模型与字段守则、13 条真机走查、发布与收录说明。
- 新增 `README.en.md`、`RELEASING.md`（发布步骤、市场文案、收录验证、回滚）、本文件。

**工程**

- 新增 `.github/workflows/ci.yml`：Node 22 / 24 × Ubuntu / Windows，跑 typecheck、全量测试、纯度门、打包清单自检。
- 新增 `tests/package-metadata.test.mjs`：把关键词、仓库字段、`files` 边界、双语 README 与 CI 的存在做成可回归的断言。
- `typescript` devDependency 由 `^5.6.0` 改为 `^5.7.0`。`tsconfig` 用了 5.7 才有的 `rewriteRelativeImportExtensions`，旧下限会让新装的机器编译失败。

## 0.2.0 — 2026-11-08

形态升级：从"零代码 skill 包"变成**客户端 + host 插件 + skill bundle**。

- 设置卡迁到设置侧边栏一级页面「学习路线」（`settings.section`），与「模型」同列；「内置插件」页内不再有同名 tab。
- 路线框架可视化编辑：增 / 删（两次点击确认，连子节）/ 选为当前 / 标没懂；每节可改 `materials`（含 enough）与 `mastery`。
- 目的驱动：首次引导第一问是目的，`job / exam / interest / career-switch` 决定路径裁剪与达标动作形态。
- 八张学习方法卡，按方法分片按需读取；自定义卡按学习者描述执行。
- 引导式陪练：行动清单 → 阶梯提示三级 → 撤掉提示独立产出；给到答案标 `gap`。
- host 半只有两个接口 `state.read` / `state.write`；工作区路径由 host 从会话解析，客户端只传 `sessionId`；写盘原子写，半截 JSON 报明确错误。
- `misconceptions` 只追加，写盘时被改写直接拒绝。
- 删除 v1 的 `references/intake.md`，由 `first-run.md` 取代；v1 的 `learning/00-路线.md` 不迁移。

## 0.1.0 — 2026-11-06

首个可用版本：问四问 → 生成路线 → 写单页讲义（`learning/00-路线.md` + 一次一页 Markdown）。
零代码 skill 包，无设置卡、无落盘路由。
