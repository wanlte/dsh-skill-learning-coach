import { Buffer } from 'node:buffer';
import { RouteError } from "./session-cwd.js";
const BODY_LIMIT = 1024 * 1024;
export async function readJsonBody(req) {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
        const bytes = typeof chunk === 'string' ? Buffer.from(chunk, 'utf8') : Buffer.from(chunk);
        size += bytes.byteLength;
        if (size > BODY_LIMIT)
            throw new RouteError('too-large', '请求体超过 1 MiB', 413);
        chunks.push(bytes);
    }
    const text = Buffer.concat(chunks).toString('utf8');
    if (text.trim() === '')
        return {};
    let parsed;
    try {
        parsed = JSON.parse(text);
    }
    catch {
        throw new RouteError('bad-request', '请求体不是合法 JSON');
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new RouteError('bad-request', '请求体必须是 JSON 对象');
    }
    return parsed;
}
export function writeJson(res, status, payload) {
    const body = JSON.stringify(payload);
    res.writeHead(status, {
        'content-type': 'application/json; charset=utf-8',
        'content-length': String(Buffer.byteLength(body)),
    });
    res.end(body);
}
export function writeOk(res, value) {
    writeJson(res, 200, { ok: true, value });
}
export function writeError(res, error) {
    if (error instanceof RouteError) {
        writeJson(res, error.status, { ok: false, error: { code: error.code, message: error.message } });
        return;
    }
    const message = error instanceof Error ? error.message : String(error);
    writeJson(res, 500, { ok: false, error: { code: 'internal', message } });
}
