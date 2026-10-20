import { useEffect, useState } from 'react';
import { Image, View } from 'react-native';
import { colors } from './theme';
import { avatarUrl } from './avatar.mjs';
export function Avatar({ uri, size = 40 }: { uri?: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [uri]);
  const source = avatarUrl(uri);
  return <View style={{ width: size, height: size, borderRadius: size / 2, flexShrink: 0, overflow: 'hidden', backgroundColor: colors.button, alignItems: 'center', justifyContent: 'center' }}>{source && !failed ? <Image accessibilityLabel="Blueskyのプロフィール画像" source={{ uri: source }} style={{ width: size, height: size }} onError={() => setFailed(true)} /> : <View accessible accessibilityRole="image" accessibilityLabel="初期プロフィールアイコン" style={{ width: size * 0.68, height: size * 0.72, alignItems: 'center', justifyContent: 'flex-end', gap: size * 0.045 }}>
      <View style={{ width: size * 0.25, height: size * 0.25, borderRadius: size, backgroundColor: colors.muted }} />
      <View style={{ width: size * 0.54, height: size * 0.29, borderTopLeftRadius: size * 0.28, borderTopRightRadius: size * 0.28, borderBottomLeftRadius: size * 0.06, borderBottomRightRadius: size * 0.06, backgroundColor: colors.muted, marginBottom: size * 0.055 }} />
    </View>}</View>;
}
