export function createLoopbackEndpoint(options?: { probe?: (url: string) => Promise<unknown> }): (request: Request) => Promise<Response>;
