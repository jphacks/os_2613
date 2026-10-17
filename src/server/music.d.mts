export type MusicTrack = { kind?: 'ambience' | 'music'; id: number; name: string; creator: string; license: string; url: string; audioUrl: string };
export function createMusicService(options?: { key?: () => string | undefined; fetcher?: typeof fetch }): (mood: string, query?: string, kind?: string) => Promise<MusicTrack[]>;
