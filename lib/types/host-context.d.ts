import type { Context as CordisContext } from '@deepseek-ai/cordis';
export interface HttpRequest {
    url?: string;
    method?: string;
    headers: Record<string, string | string[] | undefined>;
    [Symbol.asyncIterator](): AsyncIterator<string | Uint8Array>;
}
export interface HttpResponse {
    statusCode: number;
    headersSent?: boolean;
    writeHead(status: number, headers?: Record<string, string>): void;
    end(body?: string | Uint8Array): void;
}
export interface WebRoute {
    kind: 'exact' | 'prefix';
    path: string;
    handler: (req: HttpRequest, res: HttpResponse) => void | Promise<void>;
}
export interface WebServerService {
    register(route: WebRoute): () => void;
}
export interface SessionHeader {
    cwd?: string;
}
export interface SessionStoreService {
    get(id: string): {
        header: SessionHeader;
    } | undefined;
}
export interface ConnectionService {
    requestRejection(request: {
        headers: Record<string, string | string[] | undefined>;
    }): 401 | 403 | undefined;
}
export interface WorkingDirectoryService {
    readonly defaultDirectory?: string;
    get(session: {
        header: SessionHeader;
    }): string;
}
export interface SessionPersistenceService {
    stat?(sessionId: string): Promise<{
        header: SessionHeader;
    } | undefined>;
}
export interface HostContextShape {
    webServer: WebServerService;
    sessions: SessionStoreService;
    connection: ConnectionService;
    workingDirectory?: WorkingDirectoryService;
    sessionPersistence?: SessionPersistenceService;
}
export type Context = CordisContext & HostContextShape;
