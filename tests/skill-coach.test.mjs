import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { PURPOSE_KINDS } from '../lib/shared/framework.js'

const SKILL_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'skills', 'learning-coach')

function read(relative) {
  return readFileSync(join(SKILL_DIR, relative), 'utf8').replace(/\r\n/g, '\n')
}

test('coach-loop 有阶梯提示三级，且给到答案就标 gap', () => {
  const text = read('references/coach-loop.md')
  assert.ok(text.includes('阶梯提示'))
  for (const level of ['方向', '半个步骤', '答案']) assert.ok(text.includes(level), `缺第 ${level} 级`)
  assert.match(text, /第 3 级.*`gap`/, '必须写明给到第 3 级就标 gap')
  assert.ok(text.includes('不算达标'))
})

test('coach-loop 守住省 token 与只追加两条硬约束', () => {
  const text = read('references/coach-loop.md')
  assert.ok(text.includes('150'), '必须写死回复 ≤150 字')
  assert.ok(text.includes('misconceptions'))
  assert.match(text, /不要清空或改写任何已有卡壳/)
  assert.ok(text.includes('新会话'), '收口必须提醒开新会话')
  assert.ok(text.includes('只读选中的那一份'), '方法库必须选哪个读哪个')
})

test('materials 保留强制自标行与待核实规则', () => {
  const text = read('references/materials.md')
  assert.ok(text.includes('本页为 AI 现写的辅助讲义'), '页首自标行不可省略')
  assert.ok(text.includes('待核实'))
  assert.ok(text.includes('一个具体故事开场'))
})

test('materials 的达标动作按四种 purpose 变形，并禁止不可验证表述', () => {
  const text = read('references/materials.md')
  for (const kind of PURPOSE_KINDS) assert.ok(text.includes(`\`${kind}\``), `缺 purpose ${kind} 的达标形态`)
  assert.ok(text.includes('读完某章'), '必须点名禁止"读完某章"')
  assert.ok(text.includes('整门课'), '必须保留批量禁令')
})

test('materials 定义 spaced 的复习记录行，格式逐字固定', () => {
  const text = read('references/materials.md')
  assert.ok(text.includes('复习记录：达标日 YYYY-MM-DD；已复习 N 次'), '复习记录行格式被改动了，spaced.md 会读不到')
})
