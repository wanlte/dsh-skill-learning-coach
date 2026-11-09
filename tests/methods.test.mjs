import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { METHOD_IDS, SPACED_INTERVALS } from '../lib/shared/framework.js'

const SKILL_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'skills', 'learning-coach')
const METHODS_DIR = join(SKILL_DIR, 'references', 'methods')

function read(abs) {
  return readFileSync(abs, 'utf8').replace(/\r\n/g, '\n')
}

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const abs = join(dir, entry.name)
    return entry.isDirectory() ? walk(abs) : [abs]
  })
}

test('methods/ 的文件名与 METHOD_IDS 一一对应，不多不少', () => {
  const actual = readdirSync(METHODS_DIR).sort()
  assert.deepEqual(actual, METHOD_IDS.map(id => `${id}.md`).sort())
})

test('每份方法卡 ≤40 行，H1 带 id，且有分步与别做两节', () => {
  for (const id of METHOD_IDS) {
    const text = read(join(METHODS_DIR, `${id}.md`))
    const lines = text.trim().split('\n')
    assert.ok(lines.length <= 40, `${id}.md ${lines.length} 行，超过 40`)
    assert.ok(lines[0].startsWith('# '), `${id}.md 第一行必须是 H1`)
    assert.ok(lines[0].includes(`（${id}）`), `${id}.md 的 H1 必须带 id：${lines[0]}`)
    assert.ok(text.includes('## 别做'), `${id}.md 缺「别做」小节`)
    assert.ok(/^## /m.test(text.slice(lines[0].length)), `${id}.md 除 H1 外还要有分步小节`)
  }
})

test('spaced 写死间隔表、毕业条件与轮次来源', () => {
  const text = read(join(METHODS_DIR, 'spaced.md'))
  for (const days of SPACED_INTERVALS) assert.ok(text.includes(`+${days}`), `spaced.md 缺 +${days} 天`)
  assert.ok(text.includes('reviewOn'))
  assert.ok(text.includes('null'), '第五次复习后必须写 reviewOn: null')
  assert.ok(text.includes('复习记录：达标日'), '必须从讲义页尾那行拿轮次，不要问学习者')
  assert.ok(text.includes('没有调度器'), '必须写明不起后台进程')
})

test('custom 以 customMethod 为准，且保留通用护栏', () => {
  const text = read(join(METHODS_DIR, 'custom.md'))
  assert.ok(text.includes('customMethod'))
  assert.ok(text.includes('不要偷偷换成'), '必须禁止擅自改用内置方法')
  for (const guard of ['150', 'misconceptions', 'gap', 'mastery', '新会话']) {
    assert.ok(text.includes(guard), `custom.md 缺护栏 ${guard}`)
  }
})

test('整个 skill bundle 的相对链接全部可达', () => {
  const files = walk(SKILL_DIR).filter(file => file.endsWith('.md'))
  assert.equal(files.length, 14, `skill bundle 应有 14 份 Markdown，实际 ${files.length}`)
  let checked = 0
  for (const file of files) {
    for (const match of read(file).matchAll(/\]\(([^)]+)\)/g)) {
      const href = match[1].split('#')[0]
      if (href === '' || /^[a-z]+:/i.test(href)) continue
      const target = resolve(dirname(file), href)
      assert.ok(existsSync(target), `${file} 链接到不存在的 ${href}`)
      checked += 1
    }
  }
  assert.ok(checked >= 8, `只检查到 ${checked} 条链接，路由可能没写全`)
})
