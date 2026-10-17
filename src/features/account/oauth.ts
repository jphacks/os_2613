export type Identity = { did: string; handle: string; name: string };
export const restoreIdentity = async (): Promise<Identity | null> => null;
export async function signIn(_handle: string): Promise<Identity | null> { throw new Error('iPhoneのBlueskyログインは公開HTTPS URLと専用コールバックの設定後に利用できます。現在はWeb版をご利用ください。'); }
export async function signOut() {}

export const loginAvailable = false;
