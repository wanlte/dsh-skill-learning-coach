import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, resolve, sep } from 'node:path'
import { RouteError } from './session-cwd.ts'

export const STATE_RELATIVE = join('learning', 'framework.json')

export interface StateView {
  cwd: string
  path: string
  exists: boolean
  framework: unknown
}

export function resolveStatePath(cwd: string, relative: string): string {
  if (isAbsolute(relative) || relative.split(/[\\/]/).includes('..')) {
    throw new RouteError('bad-path', `状态路径必须是工作区内的相对路径："${relative}"`)
  }
  const root = resolve(cwd)
  const target = resolve(root, relative)
  if (target !== root && !target.startsWith(root + sep)) {
    throw new RouteError('outside-workspace', `路径 "${relative}" 越出了工作区`)
  }
  return target
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export async function readState(cwd: string): Promise<StateView> {
  const path = resolveStatePath(cwd, STATE_RELATIVE)
  let text: string
  try {
    text = await readFile(path, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { cwd, path, exists: false, framework: null }
    }
    throw new RouteError('read-failed', `读取 "${path}" 失败：${messageOf(error)}`, 500)
  }
  try {
    return { cwd, path, exists: true, framework: JSON.parse(text) }
  } catch {
    throw new RouteError('corrupt-state', `"${path}" 不是合法 JSON（可能上次写入被中断）；请修复或删除该文件后重试`, 409)
  }
}

export async function writeState(cwd: string, input: unknown): Promise<StateView> {
  const path = resolveStatePath(cwd, STATE_RELATIVE)
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new RouteError('bad-request', 'framework 必须是 JSON 对象')
  }
  await mkdir(dirname(path), { recursive: true })
  const temp = `${path}.${randomUUID().slice(0, 8)}.tmp`
  await writeFile(temp, `${JSON.stringify(input, null, 2)}\n`, 'utf8')
  try {
    await rename(temp, path)
  } catch (error) {
    await rm(temp, { force: true })
    throw new RouteError('write-failed', `写入 "${path}" 失败：${messageOf(error)}`, 500)
  }
  return { cwd, path, exists: true, framework: input }
}
