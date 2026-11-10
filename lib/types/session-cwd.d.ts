import type { Context } from './host-context.ts';
export declare class RouteError extends Error {
    readonly code: string;
    readonly status: number;
    constructor(code: string, message: string, status?: number);
}
export declare function resolveCwd(ctx: Context, sessionId: unknown): Promise<string>;
