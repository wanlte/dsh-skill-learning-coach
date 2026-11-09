# 路线图页（learning/路线图.html）

路线图 = `framework.json` 的一份渲染快照，离线单文件，双击就能看。
**只照 [roadmap-template.html](roadmap-template.html) 填，不自己设计版式**：不换 CSS、不加动画、不引外链、不加图表库。

## 什么时候生成

- **首次框架落盘后立刻生成一次**（`framework.json` 写完之后），收口时把路径给学习者。
- 增 / 删 / 合并节点、改 `purpose`、改 `deadline` 之后：整份重生成，直接覆盖旧文件，不留历史版本。
- 学习者说"给我看看路线图"：先读 `framework.json` 再生成，不要凭记忆画。
- 只在结构变化时生成，**不要每轮都写这个文件**。

## 怎么填

1. 读 `references/roadmap-template.html`，只替换 `{{占位符}}`，其余一个字符都不动。
2. `{{ROWS}}` 用下面「行格式」逐节点拼，顺序与 `framework.json` 的 `nodes` 一致（父在子前）。
3. 落盘 `learning/路线图.html`：先写 `learning/路线图.html.tmp` 再 rename，与 `framework.json` 同一套原子写。
4. 生成后聊天里只说两件事：文件路径 + 当前节点编号。**不要把 HTML 贴进聊天，也不要贴截图**。

## 占位符

| 占位符 | 填什么 |
| --- | --- |
| `{{TOPIC}}` | `topic`，HTML 转义 |
| `{{PURPOSE}}` | 目的的一行中文：求职·岗位 / 考试·考试名 / 兴趣·想做出的东西 / 转行·从什么到什么 |
| `{{DEADLINE}}` | `purpose.deadline`，没有就写「未定」 |
| `{{WEEKLY}}` | `weeklyMinutes` |
| `{{METHOD}}` | 方法中文名（费曼 / 主动回忆 / 间隔重复 / 交错练习 / 番茄钟 / SQ3R / 康奈尔 / 自定义） |
| `{{TOTAL}}` | 节点总数 |
| `{{DONE}}` | `status === "done"` 的个数 |
| `{{GAP}}` | `status === "gap"` 的个数 |
| `{{CURRENT}}` | `pickCurrent` 结果，没有就写「未选」 |
| `{{PERCENT}}` | `DONE / TOTAL * 100` 的整数，没有节点写 0 |
| `{{SOURCE}}` | `learning/framework.json` |
| `{{GENERATED_AT}}` | `YYYY-MM-DD HH:MM`，用本次真实时间 |

`DONE`、`GAP`、`CURRENT`、`PERCENT` 必须**用 fs 读出来的 JSON 现算**，不要沿用上一次的快照。

## 行格式

```html
<li class="node" data-depth="0">
  <div class="head">
    <span class="id">1</span>
    <span class="title">传输层在做什么</span>
    <span class="tag s-pending">待学</span>
    <span class="tag cur">当前</span>
  </div>
  <p class="mastery">不看资料，说出传输层替应用层解决了哪三件事</p>
  <p class="meta">资料 2 份 · 卡壳 1 条 · 已投入 40 分钟</p>
</li>
```

规则：

- `data-depth` = 编号里的点个数（`1` → 0，`2.1` → 1，`3.2.4` → 2），封顶 3。
- 状态标签与 class 一一对应：`pending`→`s-pending`「待学」、`assumed-known`→`s-known`「默认会」、`gap`→`s-gap`「没懂」、`drafted`→`s-drafted`「已出页」、`done`→`s-done`「走完」。
- `current` 指向的节点**多一个** `<span class="tag cur">当前</span>`。
- `mastery` 为空时写 `<p class="mastery none">（还没定达标动作）</p>`。
- `meta` 只报三个数：资料份数、`misconceptions` 条数、`minutesSpent`；`spaced` 且 `reviewOn` 非空再补 `· 下次复习 YYYY-MM-DD`。
- 所有来自 JSON 的文字都要 HTML 转义：`&` `<` `>` `"` 换成实体，避免标题里的 `<` 把页面拆坏。

## 硬约束

- 一个文件、零外部依赖，断网也能开。
- 不展示掌握度百分比、不给节点打分——`done` 只表示"无提示产出过"，不是分数。
- 这一页是只读快照。页脚已写"以 `framework.json` 为准"，不要在这页里加编辑按钮。
