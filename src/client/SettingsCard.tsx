import { useCallback, useMemo, useState, useSyncExternalStore } from 'react'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { Context } from './context-types.ts'
import { readState, saveState } from './api.ts'
import { emptyFramework } from '../shared/framework.ts'

export type SettingsCardProps = PropsLocale<'learning.coach'> & { ctx: Context }

const PROBE = emptyFramework('通道验证')

export function SettingsCard({ t, ctx }: SettingsCardProps): JSX.Element {
  const subscribe = useCallback((fn: () => void) => ctx.sessions.list.subscribe(fn), [ctx])
  const snapshot = useCallback(() => ctx.sessions.list.getSnapshot(), [ctx])
  const list = useSyncExternalStore(subscribe, snapshot)

  const options = useMemo(() => {
    const byCwd = new Map<string, { cwd: string; sessionId: string; updatedAt: number }>()
    for (const row of Object.values(list.byId)) {
      if (row.origin === 'subagent') continue
      const cwd = row.cwd
      if (cwd === undefined || cwd === '') continue
      const held = byCwd.get(cwd)
      if (held === undefined || row.updatedAt > held.updatedAt) {
        byCwd.set(cwd, { cwd, sessionId: row.id, updatedAt: row.updatedAt })
      }
    }
    return [...byCwd.values()].sort((a, b) => b.updatedAt - a.updatedAt)
  }, [list])

  const [picked, setPicked] = useState<string>('')
  const [busy, setBusy] = useState<boolean>(false)
  const [output, setOutput] = useState<string>('')
  const selected = options.find(option => option.cwd === picked) ?? options[0]

  const run = async (action: 'read' | 'write'): Promise<void> => {
    if (selected === undefined) return
    setBusy(true)
    try {
      const view = action === 'read'
        ? await readState(selected.sessionId)
        : await saveState(selected.sessionId, PROBE)
      setOutput(JSON.stringify(view, null, 2))
    } catch (error) {
      setOutput(`${t('failed')}: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setBusy(false)
    }
  }

  if (options.length === 0) return <p>{t('noWorkspace')}</p>

  return (
    <div>
      <p>{t('hint')}</p>
      <label>
        {t('workspace')}
        <select value={selected?.cwd ?? ''} onChange={event => setPicked(event.target.value)}>
          {options.map(option => <option key={option.cwd} value={option.cwd}>{option.cwd}</option>)}
        </select>
      </label>
      <div>
        <button type="button" disabled={busy} onClick={() => { void run('read') }}>{t('read')}</button>
        <button type="button" disabled={busy} onClick={() => { void run('write') }}>{busy ? t('writing') : t('write')}</button>
      </div>
      <pre>{output === '' ? t('result') : output}</pre>
    </div>
  )
}
