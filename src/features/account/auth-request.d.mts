export function createAuthRequest(): <T>(scope: string, start: () => Promise<T>) => Promise<T>;
