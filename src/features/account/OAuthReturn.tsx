import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { restoreIdentity } from './oauth';
import { colors } from '@/shared/theme';
export function OAuthReturn({ done }: { done: () => void }) {
  const [error, setError] = useState('');
  useEffect(() => { let active = true; void restoreIdentity().then(() => { if (active) done(); }).catch(() => { if (active) setError('認証画面を閉じて、元の画面で接続結果を確認してください。'); }); return () => { active = false; }; }, [done]);
  return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper, padding: 24 }}><Text style={{ color: colors.accent }}>{error || 'Blueskyとの接続を完了しています…'}</Text></View>;
}
