export const PURPOSE_KINDS = ['job', 'exam', 'interest', 'career-switch'] as const
export type PurposeKind = (typeof PURPOSE_KINDS)[number]

export const NODE_STATUSES = ['pending', 'assumed-known', 'gap', 'drafted', 'done'] as const
export type NodeStatus = (typeof NODE_STATUSES)[number]

export const METHOD_IDS = ['feynman', 'recall', 'spaced', 'interleave', 'pomodoro', 'sq3r', 'cornell', 'custom'] as const
export type MethodId = (typeof METHOD_IDS)[number]

export const MATERIAL_KINDS = ['url', 'file', 'book'] as const
export type MaterialKind = (typeof MATERIAL_KINDS)[number]

export const SPACED_INTERVALS = [1, 3, 7, 14, 30] as const

export interface Material {
  kind: MaterialKind
  ref: string
  enough: string
}

export interface FrameworkNode {
  id: string
  parent: string | null
  title: string
  status: NodeStatus
  materials: Material[]
  mastery: string
  misconceptions: string[]
  reviewOn: string | null
  lecture: string | null
  minutesSpent: number
}

export interface Framework {
  version: 1
  topic: string
  purpose: { kind: PurposeKind; detail: string; deadline: string | null }
  weeklyMinutes: number
  method: MethodId
  customMethod: string | null
  current: string | null
  nodes: FrameworkNode[]
}

export interface WorkspaceOption {
  cwd: string
  sessionId: string
  updatedAt: number
}

export class FrameworkError extends Error {
  constructor(readonly code: string, message: string) {
    super(message)
    this.name = 'FrameworkError'
  }
}

const NODE_ID = /^[1-9][0-9]*(\.[1-9][0-9]*)*$/
const DATE = /^\d{4}-\d{2}-\d{2}$/

function fail(code: string, message: string): never {
  throw new FrameworkError(code, message)
}

function requireObject(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail('bad-shape', `${field} 必须是对象`)
  }
  return value as Record<string, unknown>
}

function requireArray(value: unknown, field: string): unknown[] {
  if (!Array.isArray(value)) fail('bad-shape', `${field} 必须是数组`)
  return value
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string') fail('bad-shape', `${field} 必须是字符串`)
  return value
}

function requireNonEmpty(value: unknown, field: string): string {
  const text = requireString(value, field)
  if (text.trim() === '') fail('bad-shape', `${field} 不能为空`)
  return text
}

function requireOneOf<T extends string>(value: unknown, allowed: readonly T[], field: string): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    fail('bad-shape', `${field} 必须是 ${allowed.join(' / ')} 之一`)
  }
  return value as T
}

function requireInt(value: unknown, field: string, max: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > max) {
    fail('bad-shape', `${field} 必须是 0–${max} 的整数`)
  }
  return value
}

function requireDateOrNull(value: unknown, field: string): string | null {
  if (value === null) return null
  const text = requireString(value, field)
  if (!DATE.test(text)) fail('bad-shape', `${field} 必须是 YYYY-MM-DD 或 null`)
  return text
}

function parseMaterial(input: unknown, field: string): Material {
  const row = requireObject(input, field)
  return {
    kind: requireOneOf(row.kind, MATERIAL_KINDS, `${field}.kind`),
    ref: requireNonEmpty(row.ref, `${field}.ref`),
    enough: requireString(row.enough, `${field}.enough`),
  }
}

function parseNode(input: unknown, field: string): FrameworkNode {
  const row = requireObject(input, field)
  const id = requireNonEmpty(row.id, `${field}.id`)
  if (!NODE_ID.test(id)) fail('bad-id', `${field}.id "${id}" 必须是 1 / 3.2 这样的层级编号`)
  const parent = row.parent === null ? null : requireNonEmpty(row.parent, `${field}.parent`)
  if (parent === null && id.includes('.')) {
    fail('bad-parent', `${field} 是顶级节点，编号不能带点`)
  }
  if (parent !== null && !id.startsWith(`${parent}.`)) {
    fail('bad-parent', `${field}.parent "${parent}" 必须是编号 "${id}" 的上级`)
  }
  return {
    id,
    parent,
    title: requireNonEmpty(row.title, `${field}.title`),
    status: requireOneOf(row.status, NODE_STATUSES, `${field}.status`),
    materials: requireArray(row.materials, `${field}.materials`).map((item, i) => parseMaterial(item, `${field}.materials[${i}]`)),
    mastery: requireString(row.mastery, `${field}.mastery`),
    misconceptions: requireArray(row.misconceptions, `${field}.misconceptions`).map((item, i) => requireNonEmpty(item, `${field}.misconceptions[${i}]`)),
    reviewOn: requireDateOrNull(row.reviewOn, `${field}.reviewOn`),
    lecture: row.lecture === null ? null : requireNonEmpty(row.lecture, `${field}.lecture`),
    minutesSpent: requireInt(row.minutesSpent, `${field}.minutesSpent`, 100000),
  }
}

export function parseFramework(input: unknown): Framework {
  const row = requireObject(input, 'framework')
  if (row.version !== 1) fail('bad-version', `framework.version 必须是 1，收到 ${JSON.stringify(row.version)}`)
  const purpose = requireObject(row.purpose, 'purpose')
  const kind = requireOneOf(purpose.kind, PURPOSE_KINDS, 'purpose.kind')
  const detail = requireString(purpose.detail, 'purpose.detail')
  if ((kind === 'job' || kind === 'exam') && detail.trim() === '') {
    fail('bad-purpose', kind === 'job' ? 'purpose.detail 必须写清目标岗位' : 'purpose.detail 必须写清考试名')
  }
  const method = requireOneOf(row.method, METHOD_IDS, 'method')
  const customMethod = row.customMethod === null ? null : requireNonEmpty(row.customMethod, 'customMethod')
  if (method === 'custom' && customMethod === null) fail('bad-method', '选自定义方法时 customMethod 不能为空')
  if (method !== 'custom' && customMethod !== null) fail('bad-method', '只有选自定义方法时才有 customMethod')
  const nodes = requireArray(row.nodes, 'nodes').map((item, i) => parseNode(item, `nodes[${i}]`))
  const ids = new Set<string>()
  for (const node of nodes) {
    if (ids.has(node.id)) fail('duplicate-id', `节点编号 "${node.id}" 重复`)
    ids.add(node.id)
  }
  for (const node of nodes) {
    if (node.parent !== null && !ids.has(node.parent)) {
      fail('orphan-node', `节点 "${node.id}" 的上级 "${node.parent}" 不存在`)
    }
  }
  const current = row.current === null ? null : requireNonEmpty(row.current, 'current')
  if (current !== null && !ids.has(current)) fail('bad-current', `current "${current}" 不是已有节点`)
  return {
    version: 1,
    topic: requireNonEmpty(row.topic, 'topic'),
    purpose: { kind, detail, deadline: requireDateOrNull(purpose.deadline, 'purpose.deadline') },
    weeklyMinutes: requireInt(row.weeklyMinutes, 'weeklyMinutes', 10080),
    method,
    customMethod,
    current,
    nodes,
  }
}

export function emptyFramework(topic: string): Framework {
  return {
    version: 1,
    topic,
    purpose: { kind: 'interest', detail: '', deadline: null },
    weeklyMinutes: 0,
    method: 'feynman',
    customMethod: null,
    current: null,
    nodes: [],
  }
}

export function nodeOf(fw: Framework, id: string): FrameworkNode {
  const node = fw.nodes.find(item => item.id === id)
  if (node === undefined) fail('unknown-node', `节点 "${id}" 不存在`)
  return node
}

export function replaceNode(fw: Framework, id: string, patch: Partial<Omit<FrameworkNode, 'id'>>): Framework {
  nodeOf(fw, id)
  return { ...fw, nodes: fw.nodes.map(node => (node.id === id ? { ...node, ...patch, id: node.id } : node)) }
}

export function nextChildId(fw: Framework, parent: string | null): string {
  const prefix = parent === null ? '' : `${parent}.`
  let max = 0
  for (const node of fw.nodes) {
    if (node.parent !== parent) continue
    const value = Number(node.id.slice(prefix.length))
    if (Number.isInteger(value) && value > max) max = value
  }
  return `${prefix}${max + 1}`
}

export function addNode(fw: Framework, parent: string | null, title: string): Framework {
  if (parent !== null) nodeOf(fw, parent)
  const node: FrameworkNode = {
    id: nextChildId(fw, parent),
    parent,
    title,
    status: 'pending',
    materials: [],
    mastery: '',
    misconceptions: [],
    reviewOn: null,
    lecture: null,
    minutesSpent: 0,
  }
  const nodes = [...fw.nodes]
  if (parent === null) {
    nodes.push(node)
  } else {
    let at = nodes.findIndex(item => item.id === parent) + 1
    while (at < nodes.length && nodes[at]!.id.startsWith(`${parent}.`)) at += 1
    nodes.splice(at, 0, node)
  }
  return { ...fw, nodes }
}

export function removeSubtree(fw: Framework, id: string): Framework {
  nodeOf(fw, id)
  const nodes = fw.nodes.filter(node => node.id !== id && !node.id.startsWith(`${id}.`))
  const lost = fw.current !== null && (fw.current === id || fw.current.startsWith(`${id}.`))
  return { ...fw, nodes, current: lost ? null : fw.current }
}

export function pickCurrent(fw: Framework): string | null {
  if (fw.current !== null) return fw.current
  return fw.nodes.find(node => node.status !== 'assumed-known' && node.status !== 'done')?.id ?? null
}

export function appendMisconception(fw: Framework, id: string, text: string): Framework {
  const node = nodeOf(fw, id)
  const entry = text.trim()
  if (entry === '') fail('bad-misconception', '卡壳记录不能为空')
  if (node.misconceptions.includes(entry)) return fw
  return replaceNode(fw, id, { misconceptions: [...node.misconceptions, entry] })
}

export function assertAppendOnly(previous: Framework, next: Framework): void {
  for (const old of previous.nodes) {
    const now = next.nodes.find(node => node.id === old.id)
    if (now === undefined) continue
    if (!old.misconceptions.every((entry, i) => now.misconceptions[i] === entry)) {
      fail('misconception-rewrite', `节点 "${old.id}" 的卡壳档案只能追加，不能改写或删除`)
    }
  }
}

export function nextReviewOn(from: string, doneCount: number): string | null {
  const days = SPACED_INTERVALS[doneCount]
  if (days === undefined) return null
  const base = new Date(`${from}T00:00:00Z`)
  if (Number.isNaN(base.getTime())) fail('bad-date', `日期 "${from}" 非法`)
  base.setUTCDate(base.getUTCDate() + days)
  return base.toISOString().slice(0, 10)
}

export function workspaceOptions(rows: readonly {
  id: string
  cwd?: string
  displayTitle: string
  updatedAt: number
  origin?: string
}[]): WorkspaceOption[] {
  const byCwd = new Map<string, WorkspaceOption>()
  for (const row of rows) {
    if (row.origin === 'subagent') continue
    const cwd = row.cwd
    if (cwd === undefined || cwd === '') continue
    const held = byCwd.get(cwd)
    if (held === undefined || row.updatedAt > held.updatedAt) {
      byCwd.set(cwd, { cwd, sessionId: row.id, updatedAt: row.updatedAt })
    }
  }
  return [...byCwd.values()].sort((a, b) => b.updatedAt - a.updatedAt)
}
