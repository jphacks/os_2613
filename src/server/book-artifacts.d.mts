export type BookArtifactProvider = { configured?: boolean; characters: (text: string) => Promise<unknown>; script: (source: { title: string; opening: string; context: string }) => Promise<unknown>; image: (script: unknown, index: number, reference: string | null) => Promise<string> };
export function createCharactersEndpoint(options?: { provider?: BookArtifactProvider; root?: string }): (request: Request) => Promise<Response>;
export function createComicEndpoint(options?: { provider?: BookArtifactProvider; root?: string }): (request: Request) => Promise<Response>;
