import type { Framework } from '../shared/framework.ts'

export class CoachApiError extends Error {
  constructor(readonly code: string, message: string) {
    super(message)
    this.name = 'CoachApiError'
  }
}

export interface StateView {
  cwd: string
  path: string
  exists: boolean
  framework: Framework | null
}

function routeUrl(method: string): string {
  const base = typeof document !== 'undefined' && document.baseURI !== '' ? document.baseURI : 'http://dsh.internal/'
  const url = new URL(base)
  url.search = ''
  url.hash = ''
  if (!url.pathname.endsWith('/')) url.pathname += '/'
  return new URL(`learning-coach/api/${method}`, url.href).href
}

async function call<T>(method: string, payload: Record<string, unknown>): Promise<T> {
  let response: Response
  try {
    response = await fetch(routeUrl(method), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch (error) {
    throw new CoachApiError('network', error instanceof Error ? error.message : String(error))
  }
  const parsed = await response.json().catch(() => null) as
    { ok?: boolean; value?: unknown; error?: { code?: string; message?: string } } | null
  if (!response.ok || parsed === null || parsed.ok !== true || parsed.value === undefined) {
    throw new CoachApiError(parsed?.error?.code ?? 'http', parsed?.error?.message ?? `HTTP ${response.status}`)
  }
  return parsed.value as T
}

export function readState(sessionId: string): Promise<StateView> {
  return call<StateView>('state.read', { sessionId })
}

export function saveState(sessionId: string, framework: Framework): Promise<StateView> {
  return call<StateView>('state.write', { sessionId, framework })
}
