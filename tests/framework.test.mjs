import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  addNode, appendMisconception, assertAppendOnly, emptyFramework, nextChildId,
  nextReviewOn, nodeOf, parseFramework, pickCurrent, removeSubtree, replaceNode,
  workspaceOptions,
} from '../lib/shared/framework.js'

function seeded() {
  let fw = emptyFramework('计算机网络')
  fw = addNode(fw, null, '物理层')
  fw = addNode(fw, null, '传输层')
  fw = addNode(fw, '2', 'TCP 三次握手')
  return fw
}

test('空框架能过校验并往返', () => {
  const fw = emptyFramework('计算机网络')
  assert.deepEqual(parseFramework(JSON.parse(JSON.stringify(fw))), fw)
})

test('编号层级与上级存在性', () => {
  const fw = seeded()
  assert.deepEqual(fw.nodes.map(n => n.id), ['1', '2', '2.1'])
  assert.equal(nextChildId(fw, '2'), '2.2')
  assert.equal(nextChildId(fw, null), '3')
  assert.equal(nodeOf(fw, '2.1').parent, '2')
})

test('上级不存在 / 编号重复 / 编号格式错都被拒', () => {
  const fw = seeded()
  const orphan = { ...fw, nodes: [...fw.nodes, { ...fw.nodes[2], id: '9.1', parent: '9' }] }
  assert.throws(() => parseFramework(orphan), err => err.code === 'orphan-node')
  const dup = { ...fw, nodes: [...fw.nodes, { ...fw.nodes[0] }] }
  assert.throws(() => parseFramework(dup), err => err.code === 'duplicate-id')
  const badId = { ...fw, nodes: [{ ...fw.nodes[0], id: 'a.b', parent: null }] }
  assert.throws(() => parseFramework(badId), err => err.code === 'bad-id')
})

test('job / exam 的 detail 不能空，interest 可以空', () => {
  const fw = emptyFramework('x')
  for (const kind of ['job', 'exam']) {
    assert.throws(() => parseFramework({ ...fw, purpose: { kind, detail: '  ', deadline: null } }), err => err.code === 'bad-purpose')
  }
  assert.equal(parseFramework({ ...fw, purpose: { kind: 'interest', detail: '', deadline: null } }).purpose.kind, 'interest')
})

test('custom 方法必须带描述，非 custom 必须为 null', () => {
  const fw = emptyFramework('x')
  assert.throws(() => parseFramework({ ...fw, method: 'custom', customMethod: null }), err => err.code === 'bad-method')
  assert.throws(() => parseFramework({ ...fw, method: 'feynman', customMethod: '自己的' }), err => err.code === 'bad-method')
  assert.equal(parseFramework({ ...fw, method: 'custom', customMethod: '自己的' }).customMethod, '自己的')
})

test('weeklyMinutes 与日期边界', () => {
  const fw = emptyFramework('x')
  assert.throws(() => parseFramework({ ...fw, weeklyMinutes: -1 }), err => err.code === 'bad-shape')
  assert.throws(() => parseFramework({ ...fw, weeklyMinutes: 10081 }), err => err.code === 'bad-shape')
  assert.throws(() => parseFramework({ ...fw, weeklyMinutes: 1.5 }), err => err.code === 'bad-shape')
  assert.throws(() => parseFramework({ ...fw, purpose: { kind: 'interest', detail: '', deadline: '2026/12/20' } }), err => err.code === 'bad-shape')
})

test('current 必须指向已有节点', () => {
  const fw = seeded()
  assert.throws(() => parseFramework({ ...fw, current: '7' }), err => err.code === 'bad-current')
  assert.equal(parseFramework({ ...fw, current: '2.1' }).current, '2.1')
})

test('pickCurrent 跳过 assumed-known 与 done，点选优先', () => {
  let fw = seeded()
  fw = replaceNode(fw, '1', { status: 'assumed-known' })
  assert.equal(pickCurrent(fw), '2')
  fw = replaceNode(fw, '2', { status: 'done' })
  assert.equal(pickCurrent(fw), '2.1')
  fw = replaceNode(fw, '2.1', { status: 'done' })
  assert.equal(pickCurrent(fw), null)
  assert.equal(pickCurrent({ ...fw, current: '1' }), '1')
})

test('removeSubtree 连子孙一起删并清掉失效 current', () => {
  let fw = seeded()
  fw = addNode(fw, '2.1', '为什么不是两次')
  fw = { ...fw, current: '2.1.1' }
  const after = removeSubtree(fw, '2')
  assert.deepEqual(after.nodes.map(n => n.id), ['1'])
  assert.equal(after.current, null)
})

test('卡壳只追加：重复不加、改写被拒、删节点不算改写', () => {
  let fw = seeded()
  fw = appendMisconception(fw, '2.1', '把确认收到当成唯一目的')
  fw = appendMisconception(fw, '2.1', '把确认收到当成唯一目的')
  assert.equal(nodeOf(fw, '2.1').misconceptions.length, 1)
  assertAppendOnly(fw, fw)
  const rewritten = replaceNode(fw, '2.1', { misconceptions: ['换个说法'] })
  assert.throws(() => assertAppendOnly(fw, rewritten), err => err.code === 'misconception-rewrite')
  const shrunk = replaceNode(fw, '2.1', { misconceptions: [] })
  assert.throws(() => assertAppendOnly(fw, shrunk), err => err.code === 'misconception-rewrite')
  assertAppendOnly(fw, removeSubtree(fw, '2.1'))
  assert.throws(() => appendMisconception(fw, '2.1', '   '), err => err.code === 'bad-misconception')
})

test('间隔重复表 +1/+3/+7/+14/+30，用尽返回 null', () => {
  assert.equal(nextReviewOn('2026-11-06', 0), '2026-11-07')
  assert.equal(nextReviewOn('2026-11-06', 1), '2026-11-09')
  assert.equal(nextReviewOn('2026-11-06', 2), '2026-11-13')
  assert.equal(nextReviewOn('2026-11-06', 3), '2026-11-20')
  assert.equal(nextReviewOn('2026-11-06', 4), '2026-12-06')
  assert.equal(nextReviewOn('2026-11-06', 5), null)
  assert.equal(nextReviewOn('2026-12-20', 4), '2027-01-19')
})

test('workspaceOptions 按 cwd 去重、取最新、排除 subagent、无 cwd 的行跳过', () => {
  const rows = [
    { id: 'a', cwd: '/p1', displayTitle: 'A', updatedAt: 10 },
    { id: 'b', cwd: '/p1', displayTitle: 'B', updatedAt: 30 },
    { id: 'c', cwd: '/p2', displayTitle: 'C', updatedAt: 20 },
    { id: 'd', cwd: '/p3', displayTitle: 'D', updatedAt: 99, origin: 'subagent' },
    { id: 'e', displayTitle: 'E', updatedAt: 100 },
    { id: 'f', cwd: '', displayTitle: 'F', updatedAt: 100 },
  ]
  assert.deepEqual(workspaceOptions(rows), [
    { cwd: '/p1', sessionId: 'b', updatedAt: 30 },
    { cwd: '/p2', sessionId: 'c', updatedAt: 20 },
  ])
})
