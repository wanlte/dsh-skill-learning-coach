# 发布与生态收录

目标只有一个：让一个不认识你的人，在 registry 里搜到、一条命令装上、装完看到设置卡。

## 0 先说清收录机制

`dshai.org`、`dshmarket`（`dshmarket.com`）、`dshmarketplace.dev` 都不人工审稿，靠脚本抓两处信号：

1. GitHub 仓库的 topic：`dsh-plugin`
2. npm 包 `package.json` 的 keyword：`dsh-plugin`

**两处缺一个，页面上就搜不到。** 抓取按天跑，发布后 24–48 小时才出现，别发完十分钟就去查然后以为失败了。

`package.json` 里的 `repository` 字段是它把 npm 包和 GitHub 仓库对上的桥。仓库地址填错，收录会把两个来源当成两个包。

## 1 发布前三道门（本机可跑）

```sh
cd F:/work/dsh-skill/dsh-skill-learning-coach

# 门 1：类型与测试
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm run test                 # 构建 + 全部 node --test

# 门 2：客户端 bundle 纯度（不得 import 平台外模块）
pnpm run test:client-bundle

# 门 3：tarball 内容
pnpm pack
pnpm run pack:check           # 断言必需文件齐全、skills/ 13 份、无 HTML/无 sourcemap
npm publish --dry-run         # 打印将上传的文件清单与体积，不真的发布
```

`--dry-run` 输出里要能看到：`README.md`、`README.en.md`、`CHANGELOG.md`、`cordis.patch.yml`、`lib/index.js`、`lib/client.js`、`skills/learning-coach/**`。
`docs/superpowers/**` 这类内部计划文档**不该**出现——它们已在 `files` 里被剔除。

## 2 npm 发布

一条命令跑完（推荐，脚本里已经写了下面的所有检查）：

```sh
pwsh scripts/release.ps1              # 只跑门与干跑
pwsh scripts/release.ps1 -Publish     # 真发
```

手打的话是这个顺序：

```sh
npm config get registry          # 官方源是 https://registry.npmjs.org/
npm publish --dry-run            # 先干跑，确认文件清单
npm login --registry=https://registry.npmjs.org/
npm whoami --registry=https://registry.npmjs.org/
npm publish --registry=https://registry.npmjs.org/
```

**国内机器必看**：默认源经常是 `registry.npmmirror.com`。`publishConfig` 会把包发到官方源，但**登录 token 是按 registry 分开存的**——在镜像源上 `npm login` 拿到的 token 对 npmjs 无效，`npm publish` 会直接 401。
所以登录、whoami、publish 三条都要显式带 `--registry=https://registry.npmjs.org/`。

要点：

- 包是公开的（`publishConfig.access: public`），不需要付费组织。
- 开了 2FA 会要一次性验证码；CI 发布用 granular token，不要用 classic token。
- 版本号一旦发出去就不能覆盖。要改内容只能发新版本；真要撤，`npm unpublish <name>@<version>` 只在发布后 72 小时内有效，且会伤信誉，优先用 `npm deprecate`。
- `prepack` 会重跑 build。构建失败就不会产生 tarball，这是故意的。

发布后自查：

```sh
npm view dsh-skill-learning-coach version dist.tarball keywords repository.url --registry=https://registry.npmjs.org/
```

## 3 GitHub 仓库设置

在 GitHub 网页上做，`gh` 未安装也可以完成：

1. **About** 栏填 description：`会记住你卡在哪的 DSH 学习陪练 · roadmap in settings, state on disk, mastery by unprompted output`
2. **Topics** 逐个加上（这是收录的硬条件）：

```
dsh-plugin  dsh  deepseek-harness  skill  plugin  learning  study  education  spaced-repetition  typescript
```

3. 打 tag 并建 Release：

```sh
git tag -a v0.2.1 -m "0.2.1 — 发布就绪"
git push origin v0.2.1
```

Release 说明直接取 `CHANGELOG.md` 的 0.2.1 段。Release 不是收录的必要条件，但它是"这个包有人维护"的最便宜证据。
4. 仓库公开、Issues 打开。关掉 Issues 的仓库，registry 页面点进去是死的。

## 4 收录验证（24–48 小时后）

| 去处 | 怎么查 |
| --- | --- |
| dshai.org | 站内搜 `learning coach`；或直接搜包名，条目下应显示 npm 下载量与 GitHub star |
| dshmarket（客户端内） | 设置 → 插件市场，搜 `learning` 或 `dsh-skill-learning-coach` |
| dshmarketplace.dev | 搜 `learning-coach`，列表会显示 install 命令与 source repo |

三处都没出现时按顺序查：

1. `npm view dsh-skill-learning-coach keywords` 里有没有 `dsh-plugin`（大小写、连字符都不要错）
2. GitHub 仓库 About 下的 topics 里有没有 `dsh-plugin`
3. `npm view ... repository.url` 是否指向这个仓库
4. 抓取有延迟，隔天再看

## 5 市场文案（复制即用）

**一句话**（≤80 字符，中文）

> 记得你卡在哪的 DSH 学习陪练：路线在设置卡里改，状态在盘上，学过由无提示产出说了算。

**一句话**（English）

> A DSH study coach that remembers where you got stuck — roadmap in a native settings card, state on disk, mastery by unprompted output.

**三条要点**

- 状态外置：一个 `framework.json` 说了算，换会话、换模型都续得上
- 无提示产出才算过：撤掉提示独立做出来，给到答案标 `gap` 重学
- 卡壳档案跨会话引用：上次误解的那一点，下次开场先提

**标签**：`dsh-plugin` `skill` `learning` `study-coach` `roadmap` `settings-card`

## 6 首发前还差的一项：真机安装复核

构建与自动测试覆盖不到"装上去到底对不对"。发布前在**一台干净的机器**（或另开一个 profile）跑一次：

```sh
pnpm dsh plugin --profile desktop add dsh-skill-learning-coach
```

然后按 README 的 13 条走查逐条打勾。第 1、11、13 条必须过——它们分别对应"状态真的落盘""路由不写别人的目录""设置侧边栏真的有入口"。

本地开发机上用 link 安装过、且 13 条已打勾的话，这一步可以引用当时的结论，但要注明日期与宿主版本（本仓库开发时宿主为 DSH `0.2.1-rc.2`）。

## 7 出问题时的顺序

1. 设置卡不出现 → 先确认重启过 DSH；再 `pnpm dsh plugin --profile desktop list` 看包在不在
2. 卡片在但读不到状态 → 看该会话 cwd 下有没有 `learning/framework.json`；没有就是首次引导还没写盘
3. 写入报 403 → 客户端传的 `sessionId` 不是当前会话；换成设置卡下拉里选中的那个会话
4. 想整体回退 → `pnpm dsh plugin --profile desktop remove dsh-skill-learning-coach`，工作区文件不受影响
