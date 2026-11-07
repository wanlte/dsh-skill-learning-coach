import assert from 'node:assert/strict'
import { test } from 'node:test'
import { resolveCwd, RouteError } from '../lib/session-cwd.js'

function fakeCtx({ live, committed, header, stored }) {
  return {
    sessions: { get: id => (id === 's1' ? live : undefined) },
    get: name => {
      if (name === 'workingDirectory') return committed
      if (name === 'sessionPersistence') return { stat: async () => stored }
      return undefined
    },
  }
}

test('优先用 workingDirectory 服务的已提交目录（跟踪 cd）', async () => {
  const ctx = fakeCtx({
    live: { header: { cwd: '/orig' } },
    committed: { get: () => '/committed' },
  })
  assert.equal(await resolveCwd(ctx, 's1'), '/committed')
})

test('没有 workingDirectory 服务时回落会话 header', async () => {
  const ctx = fakeCtx({ live: { header: { cwd: '/orig' } } })
  assert.equal(await resolveCwd(ctx, 's1'), '/orig')
})

test('冷会话回落持久化 header', async () => {
  const ctx = fakeCtx({ stored: { header: { cwd: '/stored' } } })
  assert.equal(await resolveCwd(ctx, 's1'), '/stored')
})

test('三级都拿不到就拒绝，绝不回落 process.cwd()', async () => {
  const ctx = fakeCtx({})
  await assert.rejects(() => resolveCwd(ctx, 's1'), err => err instanceof RouteError && err.code === 'unknown-session')
})

test('sessionId 缺失或非字符串一律拒绝', async () => {
  const ctx = fakeCtx({ live: { header: { cwd: '/orig' } } })
  for (const bad of [undefined, null, '', '   ', 42, {}]) {
    await assert.rejects(() => resolveCwd(ctx, bad), err => err.code === 'bad-request')
  }
})
