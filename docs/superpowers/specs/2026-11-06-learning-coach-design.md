# dsh-skill-learning-coach 设计（Design Spec）

日期：2026-11-06　状态：已与用户确认，待实施
配套计划：`docs/superpowers/plans/2026-11-06-learning-coach.md`

## 一句话

给 DSH 生态补一个**引导学习**的 skill：先用提问帮学习者自己把路线讲清楚，确认后再处理资料——有资料用他的，没资料就现写"这一节"的一页辅助讲义。

## 为什么是这个形态

DSH 随包的 skill 只有 4 个 cordis 插件开发类 + 7 个 office 文档类，没有任何学习类 skill（已用 asar 索引核实）。学习者面对的共同卡点是"不知道从哪开始、资料一堆没排序"，而现有 agent 的默认行为是直接甩一份完整课表——看起来有用，实际没人执行。

本 skill 的价值不在"生成内容"，在**改变开场动作**：先问、后确认、再动笔。规则来自用户自己已经跑通的学习体系（`F:/deepseek工作区/learning/`：8 周路线 + 统一讲义结构 + 错题归因），那里 `README.md:61` 的"错题贴给我，我批改并沿追问链继续挖"目前只是散文，靠每次恰好读到才成立；本包把它变成默认动作。

## v1 边界（明确不做）

做：引导式提问 → 路线草案 → 要学习者确认 → 资料清单（用他的 / 联网找一手来源）→ 现写**一节**辅助讲义 + 落盘。

不做：苏格拉底式逐节讲解（独立 skill）、进度续读与错题本（独立 skill，且依赖上一项）、批量生成整套课程。批量生成会让它被看成一次性 AI 写作工具，且质量无法验证。后两项各做成独立 skill，生态里更像系列而非万能件。

## 结构决策

采用 **skill bundle**：`SKILL.md` 只承载流程骨架与禁令，两份可复用模板放 `references/` 按需加载（DSH 官方 bundle 用法，office 那批即如此）。发布用**零代码插件包**外壳，别人一条 `pnpm dsh plugin --profile web add github:<user>/dsh-skill-learning-coach` 装好，无构建、无依赖、不写一行 TS。

不用"一个包里塞三个 skill"：v1 就建未来的空壳，等于提前设计。

## 从官方文档核出的硬约束（实施不得违反）

来源：asar 内 `@deepseek-ai/dsh-skill-filesystem/README.zh.md`、`@deepseek-ai/dsh-skill/README.zh.md`、`dsh-web-app/presets/cordis.patch.yml`。

- skill 必须是扫描根**顶层**的 `<name>/SKILL.md`，或平铺 `<name>.md`；嵌套 `**/SKILL.md` 明确不发现。
- frontmatter 必填 `name`（kebab-case）与 `description`；可选 `whenToUse`、`metadata`、`disable-model-invocation`、`user-invocable`。布尔值写法错误会导致**整个 skill 被丢弃**（只留警告）。
- 扫描根与 rank：100 `<projectRoot>/.dsh/skills` → 200 `<projectRoot>/.agents/skills` → 300 `Config.customSkillDirs` → 400 `~/.dsh/skills` → 500 `~/.agents/skills` → 600 `bundledSkillDir`。
- `providerName` 是注册到 `ctx.skills` 的唯一提供方名；`includeDefaultRoots: false` 会省略项目根、用户根与 bundledSkillDir——自带 skill 的第三方包用"唯一 providerName + false + customSkillDirs 指本包 skills/"即可，不重复扫描别人的根。
- 带 watcher：新增/改名/删除 skill 或改 frontmatter 会在下一个模型步骤刷新目录，**无需重启**；但 `references/`、`scripts/`、`assets/` 下的编辑不触发刷新（正文每次加载重读，因此改 SKILL.md 正文也不必重启）。
- 包的 `package.json` 需 `"dsh": { "bundle": { "patch": "./cordis.patch.yml" } }` 且 `exports`/`files` 暴露 `./cordis.patch.yml` 与 `skills/**`（照抄 `dsh-experimental-badge-skill-bundle` 的字段形态）。

## 唯一未知项（已定论）

patch 里 `baseUrl` 的语义**不必再探测**：用户 `desktop` profile 里现役安装的 `dsh-super-code@0.3.10` 已给出可用实现——`createRequire(new URL('package.json', baseUrl))` 造一个 require，再 `require.resolve('<自己的包>/package.json')` 反查已安装目录、拼 skill 根，配 `providerName` 独有 + `includeDefaultRoots: false` + `watch: false` + `bundledSkillDir`（rank 600）。它的注释还写清了为何不拿 patch 文件位置当根：profile 层可能另存一份声明，按 patch 位置算会算错。

## 本机环境事实（影响验收方式）

- 本机没有 `headless` profile，DSH 在这台机器上**没有命令行问答入口**（`web` 是本地 UI 服务器），因此 skill 行为只能由用户在 DSH 界面里人工验证；agent 侧只跑不碰 profile 的静态验证。
- `desktop` profile 的启动被 Electron 应用独占，但 `dsh plugin --profile desktop add|remove|why` 可用（转发给 profile 目录的 pnpm）。
- 用户自己安装、自己验证；agent 不改动任何 profile。
- 用户的插件都装在 `desktop`：其 `package.json` 里 `dsh-voice-announcer` 以 `link:F:/work/dsh-skill/dsh-voice-announcer` 形式存在，README 的安装说明须以 desktop 为主路径。

## 验收标准

1. 撤掉临时放进 `~/.dsh/skills` 的副本后，只靠插件安装，`learning-coach` 仍出现在会话 skill 目录中。
2. 一次真实走查（只说"我想学 X"）没有出现跳过提问直接给排期；路线以草案形式等确认；产出的讲义页首有"AI 现写"自标。
3. 包内无 TS、无构建脚本、无 dependencies；`pnpm pack` 出来的 tarball 里 `skills/learning-coach/` 完整。
