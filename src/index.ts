import type { Context } from './host-context.ts'
import { resolveCwd, RouteError } from './session-cwd.ts'
import { readState, writeState } from './state.ts'
import { readJsonBody, writeError, writeJson, writeOk } from './wire.ts'

export const name = 'dsh-skill-learning-coach'

export const inject = ['webServer', 'sessions', 'connection']

type Handler = (payload: Record<string, unknown>, ctx: Context) => Promise<unknown>

const api: Record<string, Handler> = {
  'state.read': async (payload, ctx) => readState(await resolveCwd(ctx, payload.sessionId)),
  'state.write': async (payload, ctx) => writeState(await resolveCwd(ctx, payload.sessionId), payload.framework),
}

export function apply(ctx: Context): void {
  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: '/learning-coach/api',
    handler: async (req, res) => {
      if (ctx.connection.requestRejection(req) !== undefined) {
        writeJson(res, 403, { ok: false, error: { code: 'forbidden', message: 'forbidden' } })
        return
      }
      if (req.method !== 'POST') {
        writeJson(res, 405, { ok: false, error: { code: 'method-error', message: 'method not allowed' } })
        return
      }
      const pathname = new URL(req.url ?? '/', 'http://dsh.internal').pathname
      const prefix = '/learning-coach/api/'
      const method = pathname.startsWith(prefix) ? pathname.slice(prefix.length) : undefined
      if (method === undefined || method.includes('/')) {
        writeError(res, new RouteError('not-found', '未知的 learning-coach 接口', 404))
        return
      }
      try {
        const payload = await readJsonBody(req)
        const handler = Object.hasOwn(api, method) ? api[method] : undefined
        if (typeof handler !== 'function') {
          throw new RouteError('not-found', `未知的 learning-coach 接口 "${method}"`, 404)
        }
        writeOk(res, await handler(payload, ctx))
      } catch (error) {
        writeError(res, error)
      }
    },
  }), 'dsh-skill-learning-coach: /learning-coach/api routes')
}
