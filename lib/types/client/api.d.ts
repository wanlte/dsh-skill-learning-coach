import type { Framework } from '../shared/framework.ts';
export declare class CoachApiError extends Error {
    readonly code: string;
    constructor(code: string, message: string);
}
export interface StateView {
    cwd: string;
    path: string;
    exists: boolean;
    framework: Framework | null;
}
export declare function readState(sessionId: string): Promise<StateView>;
export declare function saveState(sessionId: string, framework: Framework): Promise<StateView>;
