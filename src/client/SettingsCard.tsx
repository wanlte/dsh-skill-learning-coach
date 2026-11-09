import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { Context } from './context-types.ts'
import { readState, saveState } from './api.ts'
import {
  METHOD_IDS,
  PURPOSE_KINDS,
  addNode,
  emptyFramework,
  nodeOf,
  parseFramework,
  pickCurrent,
  removeSubtree,
  replaceNode,
  workspaceOptions,
  type Framework,
  type Material,
  type MaterialKind,
  type MethodId,
  type NodeStatus,
  type PurposeKind,
} from '../shared/framework.ts'
import type { zh } from './locales.ts'
import css from './SettingsCard.module.css'

export type SettingsCardProps = PropsLocale<'learning.coach'> & { ctx: Context; close: () => void }

type LocaleKey = keyof typeof zh

const PURPOSE_LABEL: Record<PurposeKind, LocaleKey> = {
  job: 'purposeJob',
  exam: 'purposeExam',
  interest: 'purposeInterest',
  'career-switch': 'purposeCareerSwitch',
}

const METHOD_LABEL: Record<MethodId, LocaleKey> = {
  feynman: 'methodFeynman',
  recall: 'methodRecall',
  spaced: 'methodSpaced',
  interleave: 'methodInterleave',
  pomodoro: 'methodPomodoro',
  sq3r: 'methodSq3r',
  cornell: 'methodCornell',
  custom: 'methodCustom',
}

const METHOD_DESC: Record<MethodId, LocaleKey> = {
  feynman: 'methodFeynmanDesc',
  recall: 'methodRecallDesc',
  spaced: 'methodSpacedDesc',
  interleave: 'methodInterleaveDesc',
  pomodoro: 'methodPomodoroDesc',
  sq3r: 'methodSq3rDesc',
  cornell: 'methodCornellDesc',
  custom: 'methodCustomDesc',
}

const STATUS_LABEL: Record<NodeStatus, LocaleKey> = {
  pending: 'statusPending',
  'assumed-known': 'statusAssumedKnown',
  gap: 'statusGap',
  drafted: 'statusDrafted',
  done: 'statusDone',
}

const MATERIAL_LABEL: Record<MaterialKind, LocaleKey> = {
  url: 'kindUrl',
  file: 'kindFile',
  book: 'kindBook',
}

const MATERIAL_KINDS_UI: readonly MaterialKind[] = ['url', 'file', 'book']

interface TextFieldProps {
  label: string
  value: string
  hint?: string
  type?: 'text' | 'date' | 'number'
  onCommit: (next: string) => void
}

function TextField({ label, value, hint, type = 'text', onCommit }: TextFieldProps): JSX.Element {
  const [text, setText] = useState<string>(value)
  useEffect(() => { setText(value) }, [value])
  return (
    <label className={css.field}>
      <span className={css.label}>{label}</span>
      <input
        className={css.input}
        type={type}
        value={text}
        onChange={event => setText(event.target.value)}
        onBlur={() => { if (text !== value) onCommit(text) }}
      />
      {hint === undefined ? null : <span className={css.hint}>{hint}</span>}
    </label>
  )
}

interface LoadState {
  status: 'loading' | 'ready' | 'error'
  path: string
  error: string
}

export function SettingsCard({ t, ctx, close }: SettingsCardProps): JSX.Element {
  const subscribe = useCallback((fn: () => void) => ctx.sessions.list.subscribe(fn), [ctx])
  const snapshot = useCallback(() => ctx.sessions.list.getSnapshot(), [ctx])
  const list = useSyncExternalStore(subscribe, snapshot)
  const options = useMemo(() => workspaceOptions(Object.values(list.byId)), [list])

  const [picked, setPicked] = useState<string>('')
  const selected = options.find(option => option.cwd === picked) ?? options[0]
  const sessionId = selected?.sessionId

  const [draft, setDraft] = useState<Framework | null>(null)
  const [load, setLoad] = useState<LoadState>({ status: 'loading', path: '', error: '' })
  const [saveError, setSaveError] = useState<string>('')
  const [reload, setReload] = useState<number>(0)
  const saveErrorRef = useRef<string>('')
  useEffect(() => { saveErrorRef.current = saveError }, [saveError])
  const currentId = draft === null ? null : pickCurrent(draft)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [pendingRemove, setPendingRemove] = useState<string | null>(null)

  useEffect(() => {
    if (sessionId === undefined) return
    let cancelled = false
    setLoad({ status: 'loading', path: '', error: '' })
    setDraft(null)
    readState(sessionId).then(view => {
      if (cancelled) return
      setDraft(view.framework)
      setLoad({ status: 'ready', path: view.path, error: '' })
    }).catch((error: unknown) => {
      if (cancelled) return
      setLoad({ status: 'error', path: '', error: error instanceof Error ? error.message : String(error) })
    })
    return () => { cancelled = true }
  }, [sessionId, reload])

  // 盘上文件被别处改动（AI 落盘、另一个窗口编辑）时自己刷进来，不用手动重载。
  // 正在输入或上次保存失败时让路，避免把用户手里没提交的文字冲掉。
  useEffect(() => {
    if (sessionId === undefined) return
    let cancelled = false
    const tick = (): void => {
      if (saveErrorRef.current !== '') return
      const active = document.activeElement
      if (active instanceof HTMLElement && active.matches('input, textarea, select')) return
      readState(sessionId).then(view => {
        if (cancelled) return
        setDraft(previous => {
          if (previous === null) return view.framework
          return JSON.stringify(previous) === JSON.stringify(view.framework) ? previous : view.framework
        })
        setLoad(previous => previous.status === 'ready' && previous.path === view.path
          ? previous
          : { status: 'ready', path: view.path, error: '' })
      }).catch(() => { /* 轮询失败不打扰，下一次再试 */ })
    }
    const timer = setInterval(tick, 3000)
    return () => { cancelled = true; clearInterval(timer) }
  }, [sessionId])

  const commit = (next: Framework): void => {
    if (sessionId === undefined) return
    setDraft(next)
    let validated: Framework
    try {
      validated = parseFramework(next)
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : String(error))
      return
    }
    setSaveError('')
    saveState(sessionId, validated).then(view => {
      setLoad({ status: 'ready', path: view.path, error: '' })
    }).catch((error: unknown) => {
      setSaveError(error instanceof Error ? error.message : String(error))
    })
  }

  if (options.length === 0) return <p className={css.hint}>{t('noWorkspace')}</p>

  return (
    <div className={css.card}>
      <label className={css.field}>
        <span className={css.label}>{t('workspace')}</span>
        <select className={css.input} value={selected?.cwd ?? ''} onChange={event => setPicked(event.target.value)}>
          {options.map(option => <option key={option.cwd} value={option.cwd}>{option.cwd}</option>)}
        </select>
      </label>

      {load.status === 'loading' ? <p className={css.hint}>{t('loading')}</p> : null}
      {load.status === 'error' ? (
        <p className={css.error}>
          {t('loadFailed')}: {load.error}
          <button type="button" className={css.button} onClick={() => setReload(value => value + 1)}>{t('retry')}</button>
        </p>
      ) : null}
      {load.path === '' ? null : <p className={css.hint}>{t('path')}: {load.path}</p>}
      {load.status === 'ready' ? <p className={css.hint}>{t('liveSync')}</p> : null}
      {saveError === '' ? null : (
        <p className={css.error}>
          {t('saveFailed')}: {saveError}
          <button type="button" className={css.button} onClick={() => { if (draft !== null) commit(draft) }}>{t('retry')}</button>
        </p>
      )}

      {load.status === 'ready' && draft === null ? (
        <div className={css.section}>
          <p className={css.hint}>{t('emptyHint')}</p>
          <button type="button" className={css.button} onClick={() => commit(emptyFramework(t('defaultTopic')))}>{t('createEmpty')}</button>
          <button type="button" className={css.button} onClick={close}>{t('goToSession')}</button>
        </div>
      ) : null}

      {draft === null ? null : (
        <>
          <div className={css.section}>
            <TextField label={t('topic')} value={draft.topic} onCommit={next => commit({ ...draft, topic: next })} />
            <label className={css.field}>
              <span className={css.label}>{t('purpose')}</span>
              <select
                className={css.input}
                value={draft.purpose.kind}
                onChange={event => commit({ ...draft, purpose: { ...draft.purpose, kind: event.target.value as PurposeKind } })}
              >
                {PURPOSE_KINDS.map(kind => <option key={kind} value={kind}>{t(PURPOSE_LABEL[kind])}</option>)}
              </select>
            </label>
            <TextField
              label={t('purposeDetail')}
              value={draft.purpose.detail}
              hint={draft.purpose.kind === 'job' ? t('purposeDetailJob') : draft.purpose.kind === 'exam' ? t('purposeDetailExam') : undefined}
              onCommit={next => commit({ ...draft, purpose: { ...draft.purpose, detail: next } })}
            />
            <TextField
              label={t('deadline')}
              type="date"
              value={draft.purpose.deadline ?? ''}
              onCommit={next => commit({ ...draft, purpose: { ...draft.purpose, deadline: next === '' ? null : next } })}
            />
            <TextField
              label={t('weeklyMinutes')}
              type="number"
              hint={t('weeklyMinutesHint')}
              value={String(draft.weeklyMinutes)}
              onCommit={next => {
                const value = Number.parseInt(next, 10)
                if (Number.isInteger(value) && value >= 0 && value <= 10080) commit({ ...draft, weeklyMinutes: value })
              }}
            />
          </div>

          <div className={css.section}>
            <span className={css.label}>{t('framework')}</span>
            <p className={css.hint}>{t('nodeCount')}: {draft.nodes.length} · {t('currentNode')}: {currentId ?? t('none')}</p>
            <ul className={css.tree}>
              {draft.nodes.map(node => (
                <li key={node.id}>
                  <div className={node.id === currentId ? css.nodeCurrent : css.node}>
                    <span className={css.nodeId}>{node.id}</span>
                    <button
                      type="button"
                      className={css.nodeTitle}
                      style={{ background: 'none', border: 'none', color: 'inherit', font: 'inherit', textAlign: 'left', cursor: 'pointer' }}
                      onClick={() => setExpanded(value => (value === node.id ? null : node.id))}
                    >
                      {node.title}
                    </button>
                    <span className={css.badge}>{t(STATUS_LABEL[node.status])}</span>
                  </div>
                  <div className={css.nodeActions}>
                    <button type="button" className={css.button} onClick={() => commit({ ...draft, current: node.id })}>{t('select')}</button>
                    <button type="button" className={css.button} onClick={() => commit(replaceNode(draft, node.id, { status: 'gap' }))}>{t('markGap')}</button>
                    <button type="button" className={css.button} onClick={() => commit(addNode(draft, node.id, t('nodeTitle')))}>{t('addChild')}</button>
                    <button
                      type="button"
                      className={css.button}
                      onClick={() => {
                        if (pendingRemove === node.id) {
                          setPendingRemove(null)
                          setExpanded(value => (value === node.id ? null : value))
                          commit(removeSubtree(draft, node.id))
                        } else {
                          setPendingRemove(node.id)
                        }
                      }}
                    >
                      {pendingRemove === node.id ? t('confirmRemove') : t('remove')}
                    </button>
                  </div>
                  {expanded === node.id ? (
                    <div className={css.nodeBody}>
                      <TextField
                        label={t('nodeTitle')}
                        value={node.title}
                        onCommit={next => commit(replaceNode(draft, node.id, { title: next }))}
                      />
                      <TextField
                        label={t('mastery')}
                        value={node.mastery}
                        hint={t('masteryHint')}
                        onCommit={next => commit(replaceNode(draft, node.id, { mastery: next }))}
                      />
                      <span className={css.label}>{t('materials')}</span>
                      {node.materials.map((material, index) => (
                        <div key={index} className={css.material}>
                          <label className={css.field}>
                            <span className={css.label}>{t('materialKind')}</span>
                            <select
                              className={css.input}
                              value={material.kind}
                              onChange={event => {
                                const materials = node.materials.map((item, i) => (i === index ? { ...item, kind: event.target.value as MaterialKind } : item))
                                commit(replaceNode(draft, node.id, { materials }))
                              }}
                            >
                              {MATERIAL_KINDS_UI.map(kind => <option key={kind} value={kind}>{t(MATERIAL_LABEL[kind])}</option>)}
                            </select>
                          </label>
                          <TextField
                            label={t('materialRef')}
                            value={material.ref}
                            onCommit={next => {
                              const materials = node.materials.map((item, i) => (i === index ? { ...item, ref: next } : item))
                              commit(replaceNode(draft, node.id, { materials }))
                            }}
                          />
                          <TextField
                            label={t('materialLocator')}
                            value={material.locator ?? ''}
                            onCommit={next => {
                              const materials = node.materials.map((item, i) => {
                                if (i !== index) return item
                                const trimmed = next.trim()
                                if (trimmed === '') {
                                  const { kind, ref, enough } = item
                                  return { kind, ref, enough }
                                }
                                return { ...item, locator: trimmed }
                              })
                              commit(replaceNode(draft, node.id, { materials }))
                            }}
                          />
                          <TextField
                            label={t('materialEnough')}
                            value={material.enough}
                            onCommit={next => {
                              const materials = node.materials.map((item, i) => (i === index ? { ...item, enough: next } : item))
                              commit(replaceNode(draft, node.id, { materials }))
                            }}
                          />
                          <button
                            type="button"
                            className={css.button}
                            onClick={() => commit(replaceNode(draft, node.id, { materials: node.materials.filter((_, i) => i !== index) }))}
                          >
                            {t('removeMaterial')}
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        className={css.button}
                        onClick={() => {
                          const material: Material = { kind: 'url', ref: '', enough: '' }
                          commit(replaceNode(draft, node.id, { materials: [...node.materials, material] }))
                        }}
                      >
                        {t('addMaterial')}
                      </button>
                      {nodeOf(draft, node.id).misconceptions.length === 0 ? null : (
                        <>
                          <span className={css.label}>{t('misconceptions')}</span>
                          <ul className={css.mislist}>
                            {nodeOf(draft, node.id).misconceptions.map((entry, index) => <li key={index}>{entry}</li>)}
                          </ul>
                        </>
                      )}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
            <button type="button" className={css.button} onClick={() => commit(addNode(draft, null, t('nodeTitle')))}>{t('addRoot')}</button>
          </div>

          <div className={css.section}>
            <span className={css.label}>{t('method')}</span>
            <div className={css.methods}>
              {METHOD_IDS.map(id => (
                <button
                  key={id}
                  type="button"
                  className={draft.method === id ? css.methodOn : css.method}
                  onClick={() => commit({ ...draft, method: id, customMethod: id === 'custom' ? draft.customMethod ?? '' : null })}
                >
                  <span className={css.methodName}>{t(METHOD_LABEL[id])}</span>
                  <span className={css.methodDesc}>{t(METHOD_DESC[id])}</span>
                </button>
              ))}
            </div>
            {draft.method === 'custom' ? (
              <TextField
                label={t('customMethod')}
                value={draft.customMethod ?? ''}
                hint={t('customMethodHint')}
                onCommit={next => commit({ ...draft, customMethod: next.trim() === '' ? null : next.trim() })}
              />
            ) : null}
          </div>
        </>
      )}
    </div>
  )
}
