export class CoachApiError extends Error {
    code;
    constructor(code, message) {
        super(message);
        this.code = code;
        this.name = 'CoachApiError';
    }
}
function routeUrl(method) {
    const base = typeof document !== 'undefined' && document.baseURI !== '' ? document.baseURI : 'http://dsh.internal/';
    const url = new URL(base);
    url.search = '';
    url.hash = '';
    if (!url.pathname.endsWith('/'))
        url.pathname += '/';
    return new URL(`learning-coach/api/${method}`, url.href).href;
}
async function call(method, payload) {
    let response;
    try {
        response = await fetch(routeUrl(method), {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
        });
    }
    catch (error) {
        throw new CoachApiError('network', error instanceof Error ? error.message : String(error));
    }
    const parsed = await response.json().catch(() => null);
    if (!response.ok || parsed === null || parsed.ok !== true || parsed.value === undefined) {
        throw new CoachApiError(parsed?.error?.code ?? 'http', parsed?.error?.message ?? `HTTP ${response.status}`);
    }
    return parsed.value;
}
export function readState(sessionId) {
    return call('state.read', { sessionId });
}
export function saveState(sessionId, framework) {
    return call('state.write', { sessionId, framework });
}
