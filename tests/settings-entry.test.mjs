import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

const source = await readFile(new URL('../src/client/index.ts', import.meta.url), 'utf8')

test('客户端入口注册 settings.section 一级设置页面', () => {
  assert.match(source, /slots\.inject\('settings\.section'/)
  assert.match(source, /name: 'settings\.section'/)
  assert.match(source, /id: 'learning-coach'/)
  assert.match(source, /order: 30/)
})

test('不再注册 settings.plugins.tab（内置插件页内无同名 tab）', () => {
  assert.doesNotMatch(source, /settings\.plugins\.tab/)
})
