import assert from 'node:assert/strict'
import { mkdtemp, readFile, readdir, rm, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { test } from 'node:test'
import { readState, resolveStatePath, writeState, STATE_RELATIVE } from '../lib/state.js'
import { addNode, appendMisconception, emptyFramework } from '../lib/shared/framework.js'

async function workspace(t) {
  const dir = await mkdtemp(join(tmpdir(), 'lc-state-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  return dir
}

test('路径包含性：拒绝绝对路径与 ..', () => {
  assert.throws(() => resolveStatePath('/ws', '../evil.json'), err => err.code === 'bad-path')
  assert.throws(() => resolveStatePath('/ws', 'learning/../../evil.json'), err => err.code === 'bad-path')
  assert.throws(() => resolveStatePath('/ws', '/etc/evil.json'), err => err.code === 'bad-path')
  assert.throws(() => resolveStatePath('/ws', resolve('/evil.json')), err => err.code === 'bad-path')
  // 盘符路径只在 Windows 上是绝对路径；Linux 上 `C:/x` 就是个普通相对名，不该拿这条去断言。
  if (process.platform === 'win32') {
    assert.throws(() => resolveStatePath('C:/ws', 'C:/evil.json'), err => err.code === 'bad-path')
  }
  assert.equal(resolveStatePath('/ws', STATE_RELATIVE), resolve('/ws', 'learning', 'framework.json'))
})

test('没有文件时 exists=false、framework=null，不算错误', async t => {
  const dir = await workspace(t)
  const view = await readState(dir)
  assert.equal(view.exists, false)
  assert.equal(view.framework, null)
  assert.equal(view.cwd, dir)
})

test('半截 JSON 报明确错误，不静默兜底', async t => {
  const dir = await workspace(t)
  await mkdir(join(dir, 'learning'), { recursive: true })
  await writeFile(join(dir, 'learning', 'framework.json'), '{"version": 1, "top', 'utf8')
  await assert.rejects(() => readState(dir), err => err.code === 'corrupt-state' && err.status === 409)
})

test('合法 JSON 但不合框架同样报明确错误', async t => {
  const dir = await workspace(t)
  await mkdir(join(dir, 'learning'), { recursive: true })
  await writeFile(join(dir, 'learning', 'framework.json'), '{"version": 2}', 'utf8')
  await assert.rejects(() => readState(dir), err => err.code === 'invalid-state' && err.status === 409)
})

test('写入非法框架被拒且不落盘', async t => {
  const dir = await workspace(t)
  await assert.rejects(() => writeState(dir, { version: 1 }), err => err.code === 'invalid-state' && err.status === 400)
  assert.equal((await readState(dir)).exists, false)
})

test('写入合法框架后能读回，且目录里没有残留 tmp', async t => {
  const dir = await workspace(t)
  const fw = addNode(emptyFramework('计算机网络'), null, '传输层')
  const view = await writeState(dir, fw)
  assert.equal(view.exists, true)
  assert.deepEqual(view.framework, fw)
  assert.deepEqual(await readState(dir), view)
  const entries = await readdir(join(dir, 'learning'))
  assert.deepEqual(entries, ['framework.json'])
  const text = await readFile(join(dir, 'learning', 'framework.json'), 'utf8')
  assert.ok(text.endsWith('\n'))
})

test('卡壳档案被改写时拒绝写入，磁盘保持原样', async t => {
  const dir = await workspace(t)
  let fw = addNode(emptyFramework('x'), null, '传输层')
  fw = appendMisconception(fw, '1', '原始卡壳')
  await writeState(dir, fw)
  const tampered = { ...fw, nodes: [{ ...fw.nodes[0], misconceptions: ['被改掉'] }] }
  await assert.rejects(() => writeState(dir, tampered), err => err.code === 'misconception-rewrite' && err.status === 409)
  assert.deepEqual((await readState(dir)).framework.nodes[0].misconceptions, ['原始卡壳'])
})

test('追加卡壳允许写入', async t => {
  const dir = await workspace(t)
  let fw = addNode(emptyFramework('x'), null, '传输层')
  fw = appendMisconception(fw, '1', '原始卡壳')
  await writeState(dir, fw)
  const more = appendMisconception(fw, '1', '第二个卡壳')
  await writeState(dir, more)
  assert.deepEqual((await readState(dir)).framework.nodes[0].misconceptions, ['原始卡壳', '第二个卡壳'])
})
