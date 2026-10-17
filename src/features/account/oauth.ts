export type Identity = { did: string; handle: string; name: string; avatar?: string };
export const restoreIdentity = async (): Promise<Identity | null> => null;
export async function signIn(_handle: string): Promise<Identity | null> { throw new Error('iPhoneのBlueskyログインは公開HTTPS URLと専用コールバックの設定後に利用できます。現在はWeb版をご利用ください。'); }
export async function signOut() {}

export const loginAvailable = false;

export async function reviewAccess(): Promise<{ review: boolean; like: boolean; bluesky: boolean }> { return { review: false, like: false, bluesky: false }; }
export async function authorizeReviews(_bluesky = false): Promise<Identity | null> { throw new Error('投稿はWeb版でご利用ください。'); }
export async function reviewRequest(_path: string, _init?: RequestInit): Promise<any> { throw new Error('投稿はWeb版でご利用ください。'); }


export function hasOAuthCallback() { return false; }
