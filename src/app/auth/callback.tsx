import { Redirect } from 'expo-router';
// 認証コードの検証と交換は公式SDKの認証セッションが処理する。
export default function NativeAuthCallback() { return <Redirect href="/settings" />; }
