import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve, sep } from 'node:path';
import { RouteError } from "./session-cwd.js";
import { assertAppendOnly, parseFramework } from "./shared/framework.js";
export const STATE_RELATIVE = join('learning', 'framework.json');
export function resolveStatePath(cwd, relative) {
    if (isAbsolute(relative) || relative.split(/[\\/]/).includes('..')) {
        throw new RouteError('bad-path', `状态路径必须是工作区内的相对路径："${relative}"`);
    }
    const root = resolve(cwd);
    const target = resolve(root, relative);
    if (target !== root && !target.startsWith(root + sep)) {
        throw new RouteError('outside-workspace', `路径 "${relative}" 越出了工作区`);
    }
    return target;
}
function messageOf(error) {
    return error instanceof Error ? error.message : String(error);
}
export async function readState(cwd) {
    const path = resolveStatePath(cwd, STATE_RELATIVE);
    let text;
    try {
        text = await readFile(path, 'utf8');
    }
    catch (error) {
        if (error.code === 'ENOENT') {
            return { cwd, path, exists: false, framework: null };
        }
        throw new RouteError('read-failed', `读取 "${path}" 失败：${messageOf(error)}`, 500);
    }
    let parsed;
    try {
        parsed = JSON.parse(text);
    }
    catch {
        throw new RouteError('corrupt-state', `"${path}" 不是合法 JSON（可能上次写入被中断）；请修复或删除该文件后重试`, 409);
    }
    try {
        return { cwd, path, exists: true, framework: parseFramework(parsed) };
    }
    catch (error) {
        throw new RouteError('invalid-state', `"${path}" 内容不合框架：${messageOf(error)}`, 409);
    }
}
export async function writeState(cwd, input) {
    const path = resolveStatePath(cwd, STATE_RELATIVE);
    let framework;
    try {
        framework = parseFramework(input);
    }
    catch (error) {
        throw new RouteError('invalid-state', messageOf(error), 400);
    }
    const previous = await readState(cwd);
    if (previous.framework !== null) {
        try {
            assertAppendOnly(previous.framework, framework);
        }
        catch (error) {
            throw new RouteError('misconception-rewrite', messageOf(error), 409);
        }
    }
    await mkdir(dirname(path), { recursive: true });
    const temp = `${path}.${randomUUID().slice(0, 8)}.tmp`;
    await writeFile(temp, `${JSON.stringify(framework, null, 2)}\n`, 'utf8');
    try {
        await rename(temp, path);
    }
    catch (error) {
        await rm(temp, { force: true });
        throw new RouteError('write-failed', `写入 "${path}" 失败：${messageOf(error)}`, 500);
    }
    return { cwd, path, exists: true, framework };
}
