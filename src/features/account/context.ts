import { createContext } from 'react';
import type { Identity } from './oauth';
// 読書クエストの7項目：本の追加・本を読む・BGMを流す・Bluesky と連携・本のレビュー・通知オフ・ウィジェット
export type Quest = 'add' | 'read' | 'music' | 'bluesky' | 'review' | 'focus' | 'widget';
export type Preferences = { name: string; nameChosen: boolean; music: boolean; comic: boolean; characters: boolean; quests: boolean; done: Quest[] };
export type Account = { identity: Identity | null; prefs: Preferences; ready: boolean; error: string; update: (patch: Partial<Preferences>) => Promise<void>; complete: (quest: Quest) => void; login: (handle: string) => Promise<void>; logout: () => Promise<void>; refreshIdentity: () => Promise<void> };
export const AccountContext = createContext<Account | null>(null);
