import { nativeMetadata } from '@/features/account/native-metadata.mjs';
export function GET() {
  try { return Response.json(nativeMetadata(process.env.EXPO_PUBLIC_ATPROTO_NATIVE_CLIENT_ID)); }
  catch { return Response.json({ error: 'iPhone認証の公開URLは未設定です。' }, { status: 503 }); }
}
