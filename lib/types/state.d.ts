import { type Framework } from './shared/framework.ts';
export declare const STATE_RELATIVE: string;
export interface StateView {
    cwd: string;
    path: string;
    exists: boolean;
    framework: Framework | null;
}
export declare function resolveStatePath(cwd: string, relative: string): string;
export declare function readState(cwd: string): Promise<StateView>;
export declare function writeState(cwd: string, input: unknown): Promise<StateView>;
