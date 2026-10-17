export type MusicTrack = { id: number; name: string; creator: string; license: string; url: string; audioUrl: string };
export function createMusicService(options?: { key?: () => string | undefined; fetcher?: typeof fetch }): (mood: string, query?: string) => Promise<MusicTrack[]>;
