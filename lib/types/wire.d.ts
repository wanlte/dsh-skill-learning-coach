import type { HttpRequest, HttpResponse } from './host-context.ts';
export declare function readJsonBody(req: HttpRequest): Promise<Record<string, unknown>>;
export declare function writeJson(res: HttpResponse, status: number, payload: unknown): void;
export declare function writeOk(res: HttpResponse, value: unknown): void;
export declare function writeError(res: HttpResponse, error: unknown): void;
