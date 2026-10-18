export function normalizeHandle(input: string): string;
export function loopbackClientId(origin: string): string;
export function findLoopbackOrigin(origin: string, probe?: (url: string) => Promise<unknown>): Promise<string | null>;
export function loginError(error: unknown): string;
