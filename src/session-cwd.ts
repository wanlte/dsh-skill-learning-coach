import type { Context } from './host-context.ts'

export class RouteError extends Error {
  constructor(readonly code: string, message: string, readonly status: number = 400) {
    super(message)
    this.name = 'RouteError'
  }
}

export async function resolveCwd(ctx: Context, sessionId: unknown): Promise<string> {
  if (typeof sessionId !== 'string' || sessionId.trim() === '') {
    throw new RouteError('bad-request', 'sessionId 必填')
  }
  const session = ctx.sessions.get(sessionId)
  if (session !== undefined) {
    const cwd = ctx.get('workingDirectory')?.get(session) ?? session.header.cwd
    if (cwd !== undefined && cwd !== '') return cwd
  }
  const stored = await ctx.get('sessionPersistence')?.stat?.(sessionId)
  const cwd = stored?.header.cwd
  if (cwd !== undefined && cwd !== '') return cwd
  throw new RouteError('unknown-session', `会话 "${sessionId}" 没有可解析的工作区`)
}
