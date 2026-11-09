import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { NODE_STATUSES, PURPOSE_KINDS } from '../lib/shared/framework.js'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SKILL_DIR = join(ROOT, 'skills', 'learning-coach')

function read(relative) {
  return readFileSync(join(SKILL_DIR, relative), 'utf8').replace(/\r\n/g, '\n')
}

function lineCount(text) {
  return text.trim().split('\n').length
}

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const abs = join(dir, entry.name)
    return entry.isDirectory() ? walk(abs) : [abs]
  })
}

test('SKILL.md frontmatter：name 固定，description ≤80 字', () => {
  const text = read('SKILL.md')
  const match = /^---\n([\s\S]*?)\n---\n/.exec(text)
  assert.ok(match, 'SKILL.md 必须以 frontmatter 开头')
  const name = /^name:\s*(.+)$/m.exec(match[1])
  assert.ok(name, 'frontmatter 缺 name')
  assert.equal(name[1].trim(), 'learning-coach')
  const description = /^description:\s*(.+)$/m.exec(match[1])
  assert.ok(description, 'frontmatter 缺 description')
  const length = [...description[1].trim()].length
  assert.ok(length <= 80, `description ${length} 字，超过 80`)
})

test('SKILL.md 正文 ≤60 行', () => {
  const text = read('SKILL.md')
  const body = text.replace(/^---\n[\s\S]*?\n---\n/, '')
  const count = lineCount(body)
  assert.ok(count <= 60, `正文 ${count} 行，超过 60`)
})

test('skills/ 只放 Markdown 与路线图模板，没有别的资源', () => {
  const files = walk(SKILL_DIR)
  assert.ok(files.length > 0)
  const TEMPLATE = join(SKILL_DIR, 'references', 'roadmap-template.html')
  for (const file of files) {
    assert.ok(file.endsWith('.md') || file === TEMPLATE, `skills/ 里出现未登记的文件：${file}`)
  }
  assert.ok(existsSync(TEMPLATE), '路线图模板缺失')
})

test('v1 的 intake.md 已删除，first-run.md 与 framework.md 已建', () => {
  assert.equal(existsSync(join(SKILL_DIR, 'references', 'intake.md')), false, 'intake.md 必须删除，不留兼容层')
  assert.ok(lineCount(read('references/first-run.md')) >= 30)
  assert.ok(lineCount(read('references/framework.md')) >= 30)
})

test('first-run 的第一问必须是目的，一共六问', () => {
  const questions = [...read('references/first-run.md').matchAll(/^## (问 \d：.+)$/gm)].map(match => match[1])
  assert.equal(questions.length, 6, `应有六问，实际 ${questions.length}`)
  assert.ok(questions[0].startsWith('问 1：目的'), `第一问是「${questions[0]}」，不是目的`)
})

test('framework.md 覆盖全部状态、全部目的、粒度与原子写', () => {
  const text = read('references/framework.md')
  for (const status of NODE_STATUSES) assert.ok(text.includes(status), `framework.md 没提到状态 ${status}`)
  for (const kind of PURPOSE_KINDS) assert.ok(text.includes(kind), `framework.md 没提到目的 ${kind}`)
  assert.ok(text.includes('15–25'), 'framework.md 必须写死 15–25 分钟的粒度')
  assert.ok(text.includes('framework.json.tmp'), 'framework.md 必须写原子写的临时文件名')
  assert.ok(text.includes('00-路线.md'), 'framework.md 必须说明 v1 遗留文件不迁移')
})
