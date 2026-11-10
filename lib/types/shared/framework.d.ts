export declare const PURPOSE_KINDS: readonly ["job", "exam", "interest", "career-switch"];
export type PurposeKind = (typeof PURPOSE_KINDS)[number];
export declare const NODE_STATUSES: readonly ["pending", "assumed-known", "gap", "drafted", "done"];
export type NodeStatus = (typeof NODE_STATUSES)[number];
export declare const METHOD_IDS: readonly ["feynman", "recall", "spaced", "interleave", "pomodoro", "sq3r", "cornell", "custom"];
export type MethodId = (typeof METHOD_IDS)[number];
export declare const MATERIAL_KINDS: readonly ["url", "file", "book"];
export type MaterialKind = (typeof MATERIAL_KINDS)[number];
export declare const SPACED_INTERVALS: readonly [1, 3, 7, 14, 30];
export interface Material {
    kind: MaterialKind;
    ref: string;
    /** 章节号 / 页码 / 时间戳 / 段落首句。让学习者一步翻到，而不是通读整份资料 */
    locator?: string;
    enough: string;
}
export interface FrameworkNode {
    id: string;
    parent: string | null;
    title: string;
    status: NodeStatus;
    materials: Material[];
    mastery: string;
    misconceptions: string[];
    reviewOn: string | null;
    lecture: string | null;
    minutesSpent: number;
}
export interface Framework {
    version: 1;
    topic: string;
    purpose: {
        kind: PurposeKind;
        detail: string;
        deadline: string | null;
    };
    weeklyMinutes: number;
    method: MethodId;
    customMethod: string | null;
    current: string | null;
    nodes: FrameworkNode[];
}
export interface WorkspaceOption {
    cwd: string;
    sessionId: string;
    updatedAt: number;
}
export declare class FrameworkError extends Error {
    readonly code: string;
    constructor(code: string, message: string);
}
export declare function parseFramework(input: unknown): Framework;
export declare function emptyFramework(topic: string): Framework;
export declare function nodeOf(fw: Framework, id: string): FrameworkNode;
export declare function replaceNode(fw: Framework, id: string, patch: Partial<Omit<FrameworkNode, 'id'>>): Framework;
export declare function nextChildId(fw: Framework, parent: string | null): string;
export declare function addNode(fw: Framework, parent: string | null, title: string): Framework;
export declare function removeSubtree(fw: Framework, id: string): Framework;
export declare function pickCurrent(fw: Framework): string | null;
export declare function appendMisconception(fw: Framework, id: string, text: string): Framework;
export declare function assertAppendOnly(previous: Framework, next: Framework): void;
export declare function nextReviewOn(from: string, doneCount: number): string | null;
export declare function workspaceOptions(rows: readonly {
    id: string;
    cwd?: string;
    displayTitle: string;
    updatedAt: number;
    origin?: string;
}[]): WorkspaceOption[];
