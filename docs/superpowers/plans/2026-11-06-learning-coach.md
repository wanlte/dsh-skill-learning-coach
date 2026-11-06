# dsh-skill-learning-coach Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. 内容类任务（Task 5、6、7、8）另需 superpowers:writing-skills —— 写 skill 正文时按它的规则边测边改，不要一次性写完再验。

**Goal:** 给 DSH 生态发布一个零代码插件包，自带 `learning-coach` skill：先用提问帮学习者自己确认学习路线，再给方案与资料，无资料时现写"本节"一页辅助讲义。

**Architecture:** skill bundle 形态（`SKILL.md` 承载流程骨架 + `references/` 两份模板按需加载），外面套一个只做 patch 的零代码 npm 包；patch 里挂一个独有的 `dsh-skill-filesystem` 实例，`includeDefaultRoots: false` + `customSkillDirs` 指本包 `skills/`，从而自带 skill 而不动学习者的项目根/用户根扫描。

**Tech Stack:** DSH 0.2.x（`@deepseek-ai/dsh-skill`、`@deepseek-ai/dsh-skill-filesystem`、`@deepseek-ai/dsh-tool-skill` 由宿主提供）、Markdown + YAML frontmatter、pnpm、无 TypeScript、无构建。

**Spec:** `docs/superpowers/specs/2026-11-06-learning-coach-design.md`（本计划按它的边界与硬约束论证，执行时两份一起读）

**Spec 覆盖对照：** Spec「v1 边界」→ Task 5/6/7；「结构决策」→ Task 1/2/4；「硬约束」→ Task 1（格式）、Task 4（装载与 providerName）；「唯一未知项」→ Task 3；「验收标准」1→Task 4，2→Task 7，3→Task 8。

## Global Constraints

以下为 Spec「从官方文档核出的硬约束」一节的逐条照抄，每个任务都隐含遵守：

- skill 必须是扫描根**顶层**的 `<name>/SKILL.md`，或平铺 `<name>.md`；嵌套 `**/SKILL.md` 明确不被发现。
- frontmatter 必填 `name`（kebab-case）与 `description`；可选 `whenToUse`、`metadata`、`disable-model-invocation`、`user-invocable`。布尔值写法错误会导致整个 skill 被丢弃（仅留警告）。
- 扫描根与 rank：100 `<projectRoot>/.dsh/skills` → 200 `<projectRoot>/.agents/skills` → 300 `Config.customSkillDirs` → 400 `~/.dsh/skills` → 500 `~/.agents/skills` → 600 `bundledSkillDir`。
- `providerName` 是注册到 `ctx.skills` 的唯一提供方名；`includeDefaultRoots: false` 会省略项目根、用户根与 bundledSkillDir。
- 带 watcher：新增/改名/删除 skill 或改 frontmatter 会在下一个模型步骤刷新目录，无需重启；`references/` 下的编辑不触发刷新，但每次加载都重读正文，因此改 `SKILL.md` 正文同样不必重启。
- 包的 `package.json` 需 `"dsh": { "bundle": { "patch": "./cordis.patch.yml" } }`，且 `exports` / `files` 暴露 `./cordis.patch.yml` 与 `skills/**`（字段形态照抄 `@deepseek-ai/dsh-experimental-badge-skill-bundle`）。
- 零代码：包内不允许出现 TypeScript 源码、构建脚本、dependencies。
- 提问总轮数 ≤ 6；一次只写一节的一页讲义，禁止批量生成整套课程。
- AI 现写讲义页首必须有自标行，未核实内容必须标「待核实」。
- 学习者产出写在工作区 `learning/` 下（`learning/00-路线.md`、`learning/讲义/<YYYY-MM-DD>-<主题>.md`），绝不写进本包目录。

## 环境准备（所有任务通用，不是任务）

```bash
cd /f/work/dsh-skill/dsh-skill-learning-coach
export DSH="/f/Program Files (x86)/deepseekharness/resources/runtime/cli/bin/dsh.cmd"
```

`"$DSH" headless "<一句话任务>"` 会真的调用模型（消耗额度），所以计划只在每个任务的验收点用它一次；日常改文本用编辑器，不反复跑 headless。

## 验证通道修正（2026-11-06 执行 Task 1 时实测，**取代**下文 Task 3、Task 4 及各处 `dsh headless` 步骤；原文保留以留痕）

实测事实四条：

1. 本机**没有** `headless` profile：`--dump-default-config` 搜不到 headless，`~/.dsh/profiles` 只有 `desktop` 与 `web`；`dsh web --help` 显示它只是本地 UI 服务器（`--host/--port/--tls-*`），没有一次性问答入口。**所有 `"$DSH" headless ...` 步骤作废**（Task 1 Step 3、Task 5 Step 2、Task 6 Step 2、Task 8 Step 3），行为验证改由用户在 DSH 里人工完成（Task 7 Step 3 的八条清单）。
2. 用户日常用 `desktop`，而 `dsh ... desktop` 的启动被 Electron 应用独占（CLI 报 `profile "desktop" is managed exclusively by the Electron application`）；但 `dsh plugin --profile desktop <pnpm 参数>` 仍可用——该子命令只把参数转发给 profile 目录里的 pnpm，支持 `add <pkg>` / `remove <pkg>` / `why <pkg>`。
3. `baseUrl` **不再是未知项**：用户 profile 里现役安装的社区插件 `dsh-super-code@0.3.10` 就是"包自带 skill"的现成实现，直接照抄（见下面 Task 3'）。原 Task 3 的诊断步骤删除。
4. 用户要求：**不由 agent 装进任何 profile**，包做完整后他自己装、自己验。故原 Task 4 Step 3/4/5 与 Task 8 Step 3 的安装动作全部移交用户，agent 侧只跑不碰 profile 的静态验证（Task 4'）。

### Task 3'（取代 Task 3 与 Task 4 Step 1）：正式 `cordis.patch.yml`

照抄本机现役写法，只换 `id`、`providerName`、`require.resolve()` 里的包名与 skill 根相对路径：

```yaml
# dsh-skill-learning-coach bundle patch —— 只贡献本包自带的 skill，不动学习者的项目根与用户根扫描。
# 写法照本机现役的 dsh-super-code：不拿 baseUrl 当 skill 根，而是从"已安装的包"反查目录——
# profile 层可能另存一份声明，按 patch 文件位置算会算到错的地方。
- insert:
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

`watch: false` 与 super-code 一致：随包的 skill 不会在运行期被改，省一套 watcher；学习者若自己复制 bundle 到 `.dsh/skills` 去改，那边由默认根的 watch 负责。

### Task 4'（取代 Task 4 Step 2–6）：不碰 profile 的三项本地验证

- [ ] Step 1: YAML 结构（pyyaml 本机可用）

```bash
python -c "
import yaml
d=yaml.load(open('cordis.patch.yml',encoding='utf-8'),Loader=yaml.SafeLoader.__new__((dict,))) if False else None
" 2>/dev/null; python - <<'PY'
import yaml
class L(yaml.SafeLoader): pass
L.add_multi_constructor('!!', lambda loader,suffix,node: None)
d=yaml.load(open('cordis.patch.yml',encoding='utf-8'),Loader=L)
e=d[0]['insert'][0]
assert e['id']=='skill-learning-coach-bundled', e['id']
assert e['name']=='@deepseek-ai/dsh-skill-filesystem'
c=e['config']
assert c['providerName']=='learning-coach-bundled'
assert c['includeDefaultRoots'] is False and c['watch'] is False
assert 'dsh-skill-learning-coach/package.json' in c['bundledSkillDir']
assert c['bundledSkillDir'].rstrip().endswith(", 'skills')")
print('yaml ok:', e['id'])
PY
```
Expected: `yaml ok: skill-learning-coach-bundled`。（`!!js` 是 DSH 自定义标签，故注册一个忽略型 multi-constructor，只为校验结构。）

- [ ] Step 2: 在"已安装"的模拟目录里跑那条表达式，确认真指到 skill 根

```bash
T="$(mktemp -d)"; mkdir -p "$T/node_modules/dsh-skill-learning-coach"
cp package.json "$T/node_modules/dsh-skill-learning-coach/"
cp -r skills "$T/node_modules/dsh-skill-learning-coach/skills"
node -e '
const path=require("node:path"),fs=require("fs"),{pathToFileURL}=require("node:url");
const baseUrl=pathToFileURL(process.argv[1]).href;
const req=process.getBuiltinModule("node:module").createRequire(new URL("package.json",baseUrl));
const dir=path.join(path.dirname(req.resolve("dsh-skill-learning-coach/package.json")),"skills");
console.log("解析到:",dir);
if(!fs.existsSync(path.join(dir,"learning-coach","SKILL.md")))throw new Error("解析结果里没有 learning-coach/SKILL.md");
console.log("ok: 表达式在已安装情形下指向真实 skill 根");
' "$(cygpath -w "$T")/"
rm -rf "$T"
```
Expected: `ok: 表达式在已安装情形下指向真实 skill 根`。这一步专抓一个致命错别字：`require.resolve()` 里包名写错，别人装完就是"静默没有 skill"，比报错难查。

- [ ] Step 3: 包声明覆盖到位

```bash
node -e "
const p=require('./package.json');
for(const f of ['cordis.patch.yml','skills/**']) if(!p.files.includes(f))throw new Error('files 缺 '+f);
if(!('./cordis.patch.yml' in p.exports))throw new Error('exports 缺 cordis.patch.yml');
if(p.dsh.bundle.patch!=='./cordis.patch.yml')throw new Error('dsh.bundle.patch 不对');
console.log('ok: files/exports/dsh.bundle.patch 齐备')"
```

- [ ] Step 4: 提交，然后把安装交给用户

```bash
git add cordis.patch.yml
git commit -m "$(cat <<'EOF'
feat: 自带 skill 的装载 patch（照本机现役的 dsh-super-code 写法）

不拿 baseUrl 当 skill 根，而是从已安装的包反查目录：profile 层可能另存一份
声明，按 patch 文件位置算会算错。providerName 独有 + includeDefaultRoots:false，
避免重复扫描学习者的项目根与用户根。
EOF
)"
```

---

### Task 1: 包目录 + 合法占位 skill + 用用户根证明格式过关

框架先搭、内容先占位。这一步只用最简单的方式（`~/.dsh/skills`，rank 400）验证 frontmatter 过关，把格式问题在写内容之前消灭。

**Files:**
- Create: `skills/learning-coach/SKILL.md`
- Create: `docs/superpowers/plans/2026-11-06-learning-coach.md`（本文件，已在位）
- Copy（临时，Task 4 撤掉）: `~/.dsh/skills/learning-coach/`

**Interfaces:**
- Produces: skill 名 `learning-coach`；Task 4 的 `customSkillDirs` 指向的目录即本任务的 `skills/`；Task 5/6 写入 `skills/learning-coach/references/{intake,materials}.md`；Task 7 整体替换本任务的 SKILL.md 占位正文。

- [ ] **Step 1: 建目录与占位 SKILL.md**

写入 `skills/learning-coach/SKILL.md`（占位正文故意只有一行，Task 7 才替换——先让格式过关）：

```markdown
---
name: learning-coach
description: 用提问引导学习者自己确认学习路线，再给方案与资料；无资料时现写本节一页辅助讲义。Use when the user wants to start learning something or asks for a study roadmap.
whenToUse: 用户说"我想学 X / 怎么入门 X / 这些资料从哪看起 / 帮我规划学习"时。
---

# Learning Coach

占位：流程正文在 Task 7 写入。若你看到这一行，说明本 skill 已被 DSH 正确发现。
```

- [ ] **Step 2: 放进用户根**

```bash
mkdir -p ~/.dsh/skills && cp -r skills/learning-coach ~/.dsh/skills/
ls ~/.dsh/skills/learning-coach/SKILL.md
```
Expected: 打印该路径，无 "No such file"。

- [ ] **Step 3: 让 DSH 报告它看到的 skill 名单**

```bash
"$DSH" headless "只输出你现在能看到的 skill 名称，每行一个，不要解释"
```
Expected: 输出中出现 `learning-coach`。

失败排查（按顺序）：`name` 是否 kebab-case；frontmatter 两条 `---` 是否各占一行且在最前面；`~/.dsh/skills/learning-coach/` 下文件名是否正好 `SKILL.md`；有没有把它放进子目录（嵌套不被发现）。

- [ ] **Step 4: git 初始化并提交框架**

```bash
git init -b main
printf 'node_modules/\n*.tgz\n' > .gitignore
git add .gitignore skills docs
git commit -m "$(cat <<'EOF'
feat: dsh-skill-learning-coach 框架与占位 skill

用 ~/.dsh/skills 用户根先证明 frontmatter 与 bundle 目录形态过关，
再在此之上做发布外壳，避免格式问题污染内容迭代。
EOF
)"
git log --oneline -1
```
Expected: 一条 commit，工作区 `git status` 干净。

---

### Task 2: 零代码 package.json

发布外壳的第一半。字段形态照 `dsh-experimental-badge-skill-bundle`，但删掉它的 `main` / `dependencies`——本包没有代码可挂载，只贡献 Markdown bundle。

**Files:**
- Create: `package.json`

**Interfaces:**
- Produces: 包名 `dsh-skill-learning-coach`（Task 4 用它做 `pnpm dsh plugin add ./`）、`dsh.bundle.patch = ./cordis.patch.yml`（Task 3/4 创建该文件）。

- [ ] **Step 1: 写 package.json**

```json
{
  "name": "dsh-skill-learning-coach",
  "version": "0.1.0",
  "description": "DSH 生态的引导学习 skill：先用提问帮学习者自己确认学习路线，再给方案与资料清单，无资料时现写本节一页辅助讲义。零代码，只随包提供 SKILL.md bundle。",
  "type": "module",
  "exports": {
    "./cordis.patch.yml": "./cordis.patch.yml",
    "./package.json": "./package.json"
  },
  "files": [
    "cordis.patch.yml",
    "skills/**",
    "docs/**",
    "README.md",
    "LICENSE"
  ],
  "dsh": {
    "bundle": {
      "patch": "./cordis.patch.yml"
    }
  },
  "keywords": ["dsh", "deepseek-harness", "skill", "learning", "study", "roadmap"],
  "license": "MIT"
}
```

- [ ] **Step 2: 校验 JSON 与必需字段**

```bash
node -e "const p=require('./package.json');if(p.dsh?.bundle?.patch!=='./cordis.patch.yml')throw new Error('dsh.bundle.patch 不对');if(Object.keys(p.dependencies||{}).length)throw new Error('零代码包不该有 dependencies');console.log('ok',p.name,p.version)"
```
Expected: `ok dsh-skill-learning-coach 0.1.0`

- [ ] **Step 3: 提交**

```bash
git add package.json
git commit -m "feat: 零代码发布外壳的包声明（dsh.bundle.patch 指向 cordis.patch.yml）"
```

---

### Task 3: 实测 `baseUrl` 语义（把唯一未知项消灭掉）

官方 preset 里是 `createRequire(baseUrl).resolve('@deepseek-ai/dsh-agent-preset/package.json')`，那是"取别人的包目录"；我们要"取自己的包目录"，取决于 `baseUrl` 到底是本包哪个路径。先让它自己吐出真实值。

**Files:**
- Create: `cordis.patch.yml`（诊断版，Task 4 会被替换）

**Interfaces:**
- Consumes: Task 2 的 `dsh.bundle.patch`
- Produces: 一个确定的路径表达式，Task 4 正式 patch 直接采用。

- [ ] **Step 1: 写诊断 patch**

```yaml
# 诊断用：把 baseUrl 原样吐进 customSkillDirs，用 --dump-config 读它的真实值。Task 4 替换本文件。
- insert:
    - id: learning-coach-probe
      name: '@deepseek-ai/dsh-skill-filesystem'
      config:
        providerName: learning-coach-probe
        includeDefaultRoots: false
        customSkillDirs:
          - !!js String(baseUrl)
```

- [ ] **Step 2: 让 DSH 打印合成后的 profile 配置**

```bash
"$DSH" --profile web --dump-config | grep -A6 "learning-coach-probe"
```
Expected: 打印出 `baseUrl` 展开后的**绝对路径**。把这一行原样抄进 Step 3 的判定注释里，不许凭印象。

- [ ] **Step 3: 按真实值定表达式**

- 若打印值以 `.../dsh-skill-learning-coach/cordis.patch.yml` 结尾（即 baseUrl 是 patch 文件本身）→ Task 4 用
  `process.getBuiltinModule('node:path').join(process.getBuiltinModule('node:path').dirname(baseUrl), 'skills')`
- 若打印值以 `.../dsh-skill-learning-coach` 结尾（即 baseUrl 是包目录）→ Task 4 用
  `process.getBuiltinModule('node:path').join(baseUrl, 'skills')`
- 两者都不是 → 放弃 `baseUrl`，Task 4 改用 `process.cwd()` 之外的稳妥方案：`createRequire(baseUrl).resolve('./package.json')` 再取 `dirname` 拼 `skills`，并重跑 Step 2 确认。

- [ ] **Step 4: 记录结论并提交**

把 Step 2 的真实值和 Step 3 选定的表达式追加到 spec 的「唯一未知项」小节（就地改写为"已定论"），然后：

```bash
git add cordis.patch.yml docs/superpowers/specs/2026-11-06-learning-coach-design.md
git commit -m "chore: 实测 patch 中 baseUrl 语义，定下 customSkillDirs 表达式"
```

---

### Task 4: 正式 cordis.patch.yml + 本地安装 + 撤掉临时副本

外壳的第二半，也是 Spec 验收标准第 1 条。

**Files:**
- Modify: `cordis.patch.yml`（整文件替换）
- Delete（临时副本）: `~/.dsh/skills/learning-coach`

**Interfaces:**
- Consumes: Task 1 的 `skills/learning-coach/`、Task 2 的 `dsh.bundle.patch`、Task 3 定下的路径表达式
- Produces: 一条 `pnpm dsh plugin --profile web add ./` 即可安装的 skill 包；提供方名 `learning-coach`。

- [ ] **Step 1: 替换为正式 patch**

以下写法按 Task 3 的结论二选一（`dirname(baseUrl)` 版示意，若结论是"包目录"则去掉 `dirname` 一层）：

```yaml
# dsh-skill-learning-coach bundle patch —— 只贡献本包自带的 skill。
# providerName 独有 + includeDefaultRoots: false，确保不重复扫描学习者的项目根与用户根。
- insert:
    - id: learning-coach-skills
      name: '@deepseek-ai/dsh-skill-filesystem'
      config:
        providerName: learning-coach
        includeDefaultRoots: false
        customSkillDirs:
          - !!js process.getBuiltinModule('node:path').join(process.getBuiltinModule('node:path').dirname(baseUrl), 'skills')
```

- [ ] **Step 2: 确认配置真的指进了本包 skills/**

```bash
"$DSH" --profile web --dump-config | grep -B2 -A8 "learning-coach-skills"
```
Expected: `customSkillDirs` 展开成指向本包的 `.../dsh-skill-learning-coach/skills`（绝对路径）。若还是 probe 那行的值，说明 profile 有缓存，先跑 `"$DSH" --profile web --dump-default-config | grep learning-coach` 对照，再检查 `dsh.bundle.patch` 是否被 `pnpm` 装进了 profile。

- [ ] **Step 3: 装进 web profile**

```bash
pnpm dsh plugin --profile web add ./
"$DSH" --profile web --dump-config | grep -c "learning-coach-skills"
```
Expected: `add` 正常结束；`grep -c` ≥ 1。

- [ ] **Step 4: 撤掉用户根临时副本，证明只靠插件也能被发现**

```bash
rm -rf ~/.dsh/skills/learning-coach
"$DSH" headless "只输出你现在能看到的 skill 名称，每行一个，不要解释"
```
Expected: 仍出现 `learning-coach`。（撤副本这步顺带排掉一个假阳性：rank 300 的 customSkillDirs 会盖过 rank 400 的用户根，留着副本就分不清是谁在起作用。）

- [ ] **Step 5: 失败兜底（只在 Step 4 没出现 skill 时才做）**

保留插件外壳不动，把 README 的安装说明降级为"复制 bundle 到用户根"：`cp -r skills/learning-coach ~/.dsh/skills/`。此时 Spec 验收标准第 1 条判定为未达成，在提交信息里写明降级原因（大概率是 patch 层没被 profile 采纳，或 `!!js` 求值失败），并停下向用户报告——不要继续往下堆内容。

- [ ] **Step 6: 提交**

```bash
git add cordis.patch.yml
git commit -m "$(cat <<'EOF'
feat: 自带 skill 的装载 patch（独有 providerName + 只读本包 skills/）

providerName: learning-coach 与 includeDefaultRoots: false 成对使用，
避免第三方包重复扫描学习者的项目根与用户根。
EOF
)"
```

---

### Task 5: `references/intake.md` —— 提问脚本

内容第一步。四问是 Spec「v1 边界」里"引导式询问"的具体化。

**Files:**
- Create: `skills/learning-coach/references/intake.md`

**Interfaces:**
- Consumes: 无
- Produces: 四个小标题 `问 1 现状` / `问 2 时间` / `问 3 达标` / `问 4 资料`，Task 7 的 SKILL.md 第 1 节按这些名字引用它。

- [ ] **Step 1: 写文件**

```markdown
# 起点四问（intake）

规则：每轮只问一个问题，等回答再问下一个；总轮数 ≤ 6；问不出就用"三选一"兜底，不许无限追问。
每一问都要**具体动作**，形容词不算答案。

## 问 1 现状
"你现在能独立做出什么？说一件具体的事——'能改别人写的页面样式'比'了解 HTML'有用。"
追问（仅当对方给的是形容词，最多一次）："那上次你实际动手做的是哪个东西？"
算过了：能说出 1–2 件"看得懂但自己独立完成不了"的事。

## 问 2 时间
"过去一周你真花在这上面的时间是多少？按上周真实值算，别按理想计划。"
追问（最多一次）："那每天固定能空出来、不会被打断的是哪一段？"
算过了：拿到一个具体数字（小时/天 或 小时/周）。

## 问 3 达标
"学到什么程度算成了？说一件到时候你能做的事。"（能独立做出 X / 能答出某类面试题 / 能定位某类故障）
追问（最多一次）："那件事有没有一个能判断做没做成的标准？"
算过了：达标条件是一个可验证的动作，不是"学会了"。

## 问 4 资料
"你手上已经有什么资料？书、课程、文档、本地文件路径都算，说一下都有哪些。"
算过了：能判断该用他的资料排顺序，还是要现找。

## 六轮上限的兜底
某一问在 6 轮内问不出：给三选一让他挑，并说明"先按这个假设定路线，之后随时能改"。
示例："按经验，起点最常见三种：A 完全没碰过；B 能看懂但改不动；C 能改但说不清为什么。你算哪个？"

## 够了的判断
四问都有具体答案，且学习者能自己复述"我先做哪一步"。缺任一项就继续问；齐了立刻进入路线草案，不再追加问题。
```

- [ ] **Step 2: 单点验证——它会不会先问而不是先排课**

```bash
"$DSH" headless "我想学前端。请按 learning-coach skill 处理这个开场，输出你的第一句话。"
```
Expected: 第一句是一个**具体问题**（对应"问 1 现状"），不含周次、不含课表、不一次抛出四个问题。

- [ ] **Step 3: 不合格就改文案再跑一次 Step 2**（合格判据同 Step 2；本任务最多重试 2 次，仍不合格则记录现象并继续 Task 6，问题留到 Task 7 一起收）

- [ ] **Step 4: 提交**

```bash
git add skills/learning-coach/references/intake.md
git commit -m "feat: 起点四问提问脚本（每轮一问、六轮上限、三选一兜底）"
```

---

### Task 6: `references/materials.md` —— 现写讲义的单页模板

内容第二步。模板结构取自用户已跑通的 `F:/deepseek工作区/learning/` 讲义结构，砍掉面试专用段（追问链归入"常见踩坑"，速记卡不做）。

**Files:**
- Create: `skills/learning-coach/references/materials.md`

**Interfaces:**
- Consumes: 无
- Produces: 六段小标题 `1 先给问题` … `6 来源` 与一行强制自标文案，Task 7 的 SKILL.md 第 4 节引用。

- [ ] **Step 1: 写文件**

```markdown
# 单页辅助讲义模板（materials）

一次只写路线中**当前这一节**的一页。目标：读完能回答页首那几个问题，并能做最后那个动作。

页首第一行必须是自标，不可省略、不可改写：

> 本页为 AI 现写的辅助讲义，用于快速建立骨架；以文末来源为准。说法与官方文档冲突时，以来源为准，未经核实的已标「待核实」。

## 1 先给问题
这一节读完你要能回答的 2–3 个问题。只列问题，不给答案。

## 2 一个具体故事开场
用一个人 + 一件具体的事，讲清"没有它会怎样"。不要拿术语堆叠开头；名词第一次出现就给一句人话解释。

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

## 6 来源
联网查到的 2–3 个一手来源：URL + 访问日期 + 一句话说明它权威在哪（官方文档、规范、教材章节优先，二手博客不作唯一来源）。
资料来自学习者自己的文件时：写文件路径与对应段落位置，不复制原文大段进讲义。
```

- [ ] **Step 2: 单点验证——一页的形态与自标**

```bash
"$DSH" headless "按 learning-coach 的 materials 模板，给我写'HTTP 缓存'这一节的辅助讲义，只写这一页。"
```
Expected: 页首出现自标行原文；六段齐全；自测题 3 道且答案在末尾；末尾有带 URL 与访问日期的来源；全文只这一页，没有顺手再写第二节。

- [ ] **Step 3: 不合格就改 Step 1 文案后重跑 Step 2**（最多重试 2 次）

- [ ] **Step 4: 提交**

```bash
git add skills/learning-coach/references/materials.md
git commit -m "feat: 单页辅助讲义模板（强制自标 + 待核实 + 一手来源）"
```

---

### Task 7: SKILL.md 正文 + 完整真实走查

替换 Task 1 的占位正文，写清流程与禁令，并把 references 的**读取时机**写明——DSH 的 bundle 正文按需加载，不写时机就等于模板不会被动。然后按 Spec 验收标准第 2 条跑一次完整走查。

**Files:**
- Modify: `skills/learning-coach/SKILL.md`（整文件替换）

**Interfaces:**
- Consumes: Task 5 的 `references/intake.md`（四问标题）、Task 6 的 `references/materials.md`（六段 + 自标行）
- Produces: 面向学习者的最终行为，与产出路径约定 `learning/00-路线.md`、`learning/讲义/<YYYY-MM-DD>-<主题>.md`。

- [ ] **Step 1: 替换 SKILL.md**

```markdown
---
name: learning-coach
description: 用提问引导学习者自己确认学习路线，再给方案与资料；无资料时现写本节一页辅助讲义。Use when the user wants to start learning something, asks for a study roadmap, has unorganized study materials, or says they don't know what to learn next.
whenToUse: 用户说"我想学 X / 怎么入门 X / 这些资料从哪看起 / 帮我规划学习 / 我不知道下一步学什么"，或需要把学习方向讲到能执行时。
---

# Learning Coach

先问，后确认，再动笔。跳过提问直接输出课表，就是本 skill 的失败。

## 1 问：确认起点

读 [intake.md](references/intake.md)，按其中"问 1 现状 / 问 2 时间 / 问 3 达标 / 问 4 资料"逐条提问，每轮只问一个问题，总轮数 ≤ 6。
四问没收齐，不进第 2 节。问不出时按脚本的"三选一"兜底并说明假设可改。

## 2 定：路线草案

依据四问给**草案**，四件东西都要有：阶段划分、每阶段结束时"能做到的事"、按他真实可投入时间折算的周期、第一个具体动作。
然后显式问一句："这条路线你认吗？哪个阶段想调？"
学习者确认之前不落盘、不写讲义。确认后再写入学习者工作区 `learning/00-路线.md`（无 `learning/` 目录则创建）。

## 3 资料：先看他自己有什么

按第 1 节"问 4 资料"的答案分流：

- 有资料：本地路径直接读，链接用 tool-web 的 fetch 读。按路线排先后，每份标清对应哪一阶段、读到什么程度算够。
- 没资料：用 tool-web 的 search + fetch 找 2–3 个一手来源（官方文档、规范、教材章节优先），列 URL 与访问日期。找不到就直说找不到，不用泛泛的"网上有很多教程"糊过去。

## 4 现写"这一节"的一页辅助讲义

只写路线里**当前要学的那一节**，一次一页。结构、自标行与「待核实」规则读 [materials.md](references/materials.md)。
写到 `learning/讲义/<YYYY-MM-DD>-<主题>.md`。

**禁止批量生成整套课程讲义。** 学习者要求全部生成时，先说明为什么一次一页（写完这一页要读完，再决定下一节怎么走），然后只交当前这一页。

## 5 收口

结束时说清三件事：路线落在哪个文件、这一页讲义在哪、下一节的第一个动作是什么。
不给掌握度打分，不宣称"你已经学会了"——他读完这一页并答对自测题，才算走完了这次。
```

- [ ] **Step 2: 静态检查（不消耗模型额度）**

```bash
node -e '
const fs=require("node:fs");const p="skills/learning-coach/SKILL.md";
const s=fs.readFileSync(p,"utf8");
const m=/^---\n([\s\S]*?)\n---\n/.exec(s); if(!m)throw new Error("frontmatter 缺失或格式不对");
if(!/^name: [a-z][a-z0-9-]*$/m.test(m[1]))throw new Error("name 不是 kebab-case");
if(!/^description: .+/m.test(m[1]))throw new Error("description 缺失");
for(const f of ["references/intake.md","references/materials.md"])
  if(!s.includes(f))throw new Error("正文没引用 "+f);
  console.log("ok: frontmatter 合法且两份 references 都被引用");
'
ls skills/learning-coach skills/learning-coach/references
```
Expected: `ok: frontmatter 合法且两份 references 都被引用`；`references/` 下正好两个文件。

- [ ] **Step 3: 完整走查（人工，在 `"$DSH" web` 会话里做——多轮提问 headless 测不了）**

开场只说"我想学前端"，然后按自己的真实情况回答。逐条核对，全过才算完：

1. 第一句是提问，不是课表；每轮只问一个问题
2. 四问收齐前没出现"第 N 周"字样
3. 路线是草案，且明确等一句"你认吗"
4. 确认后 `learning/00-路线.md` 真的被创建，内容含阶段 / 能做到的事 / 周期 / 第一个动作
5. 它问了资料，并按"有/没有"分别走了排顺序或联网找来源
6. 只产出一页讲义，页首有自标行，六段齐全，自测题答案在末尾
7. 中途试着插一句"把八周的讲义都写出来"——它应当拒绝并解释，只交当前一页
8. 结束时报出三个路径/动作

- [ ] **Step 4: 任一条不过，改 SKILL.md 或模板后回 Step 3 重跑**（改完不需重启，DSH 的 watcher 会重读正文）

- [ ] **Step 5: 提交**

```bash
git add skills/learning-coach/SKILL.md
git commit -m "$(cat <<'EOF'
feat: learning-coach 流程骨架（先问后确认再动笔 + 一次一页）

references 的读取时机写进正文：DSH bundle 的正文按需加载，
不指明何时读 intake/materials，模板就不会被动。
EOF
)"
```

---

### Task 8: README + 打包自检（Spec 验收标准第 3 条）

**Files:**
- Create: `README.md`
- Create: `LICENSE`（MIT，照 `../dsh-voice-announcer/LICENSE` 复制并改版权行）

**Interfaces:**
- Consumes: Task 1–7 的全部产物
- Produces: 别人照着 README 能装上并用起来；发布包内容清单。

- [ ] **Step 1: 写 README**（整段照抄，只把 `<你的用户名>` 换成真实 GitHub 用户名——这是全计划唯一允许留到发布时填的占位）

```markdown
# dsh-skill-learning-coach · DSH 引导学习 skill

让 DSH 先问、再确认、后动笔：帮你把学习路线自己讲清楚，并写出当前这一节的辅助讲义。

## 为什么做这个 skill

DSH 随包的 skill 只有 cordis 插件开发类和 office 文档类，没有学习类的。而 agent 面对"我想学 X"
的默认动作是直接甩出一份完整课表——看着有用，没人执行，因为它不知道你现在会什么、每天真能挤出
多少时间、学到什么程度算成了。

本 skill 改的是**开场动作**，不是生成更多内容：先问四件事，再给路线草案等你确认，确认后才落盘、
才动笔写讲义。

## 装它

```sh
pnpm dsh plugin --profile web add github:<你的用户名>/dsh-skill-learning-coach
# 本地开发：pnpm dsh plugin --profile web add ./
```

重启 `dsh web` 后，skill 目录由 watcher 自动刷新，之后改 skill 正文不必重启。

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

零代码：无 TypeScript、无构建、无依赖。License MIT。
```

注意：README 里嵌套代码块会让外层 ``` 提前闭合，写入时把外层围栏改成四个反引号（````markdown），或在照抄时手工去掉内层围栏改用缩进 4 空格。

- [ ] **Step 2: 打包自检**（落在当前目录，不写 `/tmp`——Git Bash 的 `/tmp` 传给 pnpm 会被解析成 Windows 路径，容易看不清装的是哪个文件）

```bash
TARBALL="$(pnpm pack --pack-destination . | tail -1)"
echo "tarball: $TARBALL"
tar -tzf "$TARBALL" | sort
```
Expected: 清单里同时有 `package/cordis.patch.yml`、`package/skills/learning-coach/SKILL.md`、`package/skills/learning-coach/references/intake.md`、`package/skills/learning-coach/references/materials.md`、`package/README.md`、`package/package.json`；**没有** `lib/`、没有 `.ts`、没有 `node_modules`。

- [ ] **Step 3: 从 tarball 装一次，再验发现链路**

```bash
pnpm dsh plugin --profile web add "$TARBALL"
"$DSH" headless "只输出你现在能看到的 skill 名称，每行一个，不要解释"
rm -f "$TARBALL"
```
Expected: 输出含 `learning-coach`——此时装的是发布产物而不是本地目录，这才是别人拿到的东西。
（若之前装过本地目录版，先 `pnpm dsh plugin --profile web remove dsh-skill-learning-coach` 再装 tarball；`remove` 子命令名不通就改用 `un` / `rm`，以 `pnpm dsh plugin --help` 的输出为准，不要猜。）

- [ ] **Step 4: 提交**

```bash
git add README.md LICENSE
git commit -m "docs: 安装与用法说明，明确本 skill 故意不做的三件事"
```

---

## 计划外的事（不要在本计划里顺手做）

- 讲解 skill、进度与错题 skill：各自独立立项，别加进本包。
- 发布到 dshmarket / 推 GitHub：用户明确要求后再做，本计划止于 tarball 自检。
- 若 Task 4 走了 Step 5 降级兜底：Spec 验收第 1 条未达成，须在下一轮向用户报告并单独排查 profile patch 采纳机制。
