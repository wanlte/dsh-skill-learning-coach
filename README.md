# dsh-skill-learning-coach · DSH 引导学习 skill

让 DSH 先问、再确认、后动笔：帮你把学习路线自己讲清楚，并写出当前这一节的辅助讲义。

零代码插件包——没有 TypeScript、没有构建、没有依赖，随包只带一份 skill bundle。

## 为什么做这个 skill

DSH 随包的 skill 只有 cordis 插件开发类和 office 文档类，没有学习类的。而 agent 面对"我想学 X"
的默认动作是直接甩出一份完整课表——看着有用，没人执行，因为它不知道你现在会什么、每天真能挤出
多少时间、学到什么程度算成了。

本 skill 改的是**开场动作**，不是生成更多内容：先问四件事，再给路线草案等你确认，确认后才落盘、
才动笔写讲义。

## 装它

桌面版（`desktop` profile，日常在用这条）：

```sh
pnpm dsh plugin --profile desktop add github:<你的用户名>/dsh-skill-learning-coach
```

本地开发（改一次生效一次，不用重装）：

```sh
pnpm dsh plugin --profile desktop add link:F:/work/dsh-skill/dsh-skill-learning-coach
```

装了 `web` profile 的把 `desktop` 换成 `web` 即可。装完重启 DSH；之后 skill 正文改动不必重启，
每次加载都重读文件。

**不想装插件的走法**：把 `skills/learning-coach` 整个目录复制到 `~/.dsh/skills/` 下就生效
（DSH 会扫描这个用户根目录）。只要目录形态是 `<根>/learning-coach/SKILL.md` 就行。

回滚：`pnpm dsh plugin --profile desktop remove dsh-skill-learning-coach`，或删掉复制过去的目录。

## 怎么用

说一句「我想学 <某个东西>」。它会问你四件事：

1. 现在能独立做到哪
2. 过去一周真花了多少时间（按真实值，不按理想计划）
3. 学到什么程度算成了（要一件到时候能做的事）
4. 手上已经有什么资料

四问收齐后给一条**路线草案**等你确认；确认后写 `learning/00-路线.md`，
并为当前这一节写一页辅助讲义到 `learning/讲义/<日期>-<主题>.md`。
没资料时它用 DSH 自带的联网工具去找 2–3 个一手来源，并附 URL 与访问日期。

## 它故意不做什么

- 不做逐节苏格拉底式讲解（后续的独立 skill）
- 不记进度、不管错题本（再后续的独立 skill，依赖上一条）
- 不批量生成整套课程讲义——一次写完十节没人读，也没法验证写得对不对

## 规则从哪来

提问脚本和讲义模板不是凭空写的，来自一套已跑通的求职架构学习体系（8 周路线 + 统一讲义结构 +
错题归因）。那套体系里"错题贴给我，我批改并沿追问链继续挖"原本只是文档里的一句话，只有恰好被
读到才成立；本包把这类约定固化成每次都会生效的动作。

## 结构

```
skills/learning-coach/
├── SKILL.md              流程骨架：先问 → 确认 → 资料 → 现写一节一页
└── references/
    ├── intake.md         起点四问的提问脚本与兜底规则
    └── materials.md      单页辅助讲义模板与自标注规则
cordis.patch.yml          只挂载本包 skills/，不动学习者的项目根与用户根扫描
```

装载写法照本机现役的 `dsh-super-code`：用 `require.resolve('<本包>/package.json')` 反查已安装
目录，而不是拿 patch 文件位置当 skill 根；配 `providerName` 独有 + `includeDefaultRoots: false`，
避免重复扫描别人的根目录。

## 已知未验

安装与行为验证需在真实 DSH 里跑一次（本机无命令行问答入口）。若装完看不到 `learning-coach`，
先按上面的"不想装插件的走法"验证 bundle 本身，再把 `pnpm dsh plugin ... why dsh-skill-learning-coach`
的输出贴回来。

License MIT.
