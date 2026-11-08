# 变更记录

版本遵循 [SemVer](https://semver.org/lang/zh-CN/)。本仓库此前只在本地与 link 安装使用，`0.2.1` 起准备发布到 npm。

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
