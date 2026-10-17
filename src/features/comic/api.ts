import Constants from 'expo-constants';
import { Platform } from 'react-native';
export function artifactUrl(path: string) {
  if (Platform.OS === 'web') return path;
  const config = Constants.expoConfig;
  const plugin = config?.plugins?.find(value => Array.isArray(value) && value[0] === 'expo-router');
  const configured = config?.extra?.apiOrigin ?? (Array.isArray(plugin) ? plugin[1]?.origin : undefined);
  const origin = __DEV__ && config?.hostUri ? `http://${config.hostUri}` : configured;
  if (typeof origin !== 'string' || !/^https?:\/\//.test(origin) || (!__DEV__ && !origin.startsWith('https://'))) throw new Error('接続先が設定されていません。アプリの配信設定を確認してください。');
  return new URL(path, origin).toString();
}
export async function artifactRequest(path: string, body: unknown, signal: AbortSignal) {
  const response = await fetch(artifactUrl(path), { ...(body !== null ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}), signal });
  const value = await response.json();
  if (!response.ok) {
    const messages: Record<string, string> = { NOT_CONFIGURED: '作成の準備が整っていません。起動時の接続設定を確認してください。', AUTH: '生成サービスへ接続できません。接続設定を確認してください。', RATE_LIMIT: 'ただいま混み合っています。少し時間をおいてお試しください。', BUSY: '別の作成を進めています。少し待ってからお試しください。', LIMIT: '作成回数の上限に達しました。', TIMEOUT: '作成に時間がかかっています。少し待ってからお試しください。', UNGROUNDED: '本文に一致する根拠を確認できませんでした。もう一度お試しください。', STORAGE: '保存できませんでした。保存先の状態を確認してください。', INVALID_INPUT: '本文やしおりを選び直してください。' };
    throw new Error(messages[value?.code] ?? '取得できませんでした。通信を確認し、もう一度お試しください。');
  }
  return value;
}
