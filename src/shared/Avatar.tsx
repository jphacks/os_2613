import { useEffect, useState } from 'react';
import { Image, Text, View } from 'react-native';
import { colors } from './theme';
import { avatarUrl } from './avatar.mjs';
export function Avatar({ uri, size = 40 }: { uri?: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [uri]);
  const source = avatarUrl(uri);
  return <View style={{ width: size, height: size, borderRadius: size / 2, flexShrink: 0, overflow: 'hidden', backgroundColor: colors.line, alignItems: 'center', justifyContent: 'center' }}>{source && !failed ? <Image accessibilityLabel="Blueskyのプロフィール画像" source={{ uri: source }} style={{ width: size, height: size }} onError={() => setFailed(true)} /> : <Text style={{ color: colors.accent, fontSize: size * 0.45 }}>▤</Text>}</View>;
}
