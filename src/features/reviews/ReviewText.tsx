import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { colors } from '@/shared/theme';
// 全文の高さを測り、3行を超えた場合だけ最後の行の右端を紙の色へなじませる。
export function ReviewText({ text, expanded = false, compact = false }: { text: string; expanded?: boolean; compact?: boolean }) {
  const lineHeight = compact ? 22 : 27;
  const [truncated, setTruncated] = useState(false);
  const type = { color: colors.ink, fontSize: compact ? 14 : 15, lineHeight };
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="72" height="${lineHeight}"><defs><linearGradient id="fade"><stop offset="0" stop-color="${colors.surface}" stop-opacity="0"/><stop offset="1" stop-color="${colors.surface}" stop-opacity="0.92"/></linearGradient></defs><rect width="72" height="${lineHeight}" fill="url(#fade)"/></svg>`;
  return <View style={{ position: 'relative' }}>
    {!expanded && <Text accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none" onLayout={event => setTruncated(event.nativeEvent.layout.height > lineHeight * 3 + 1)} style={[type, s.measure]}>{text}</Text>}
    <Text selectable={expanded} numberOfLines={expanded ? undefined : 3} ellipsizeMode="tail" style={type}>{text}</Text>
    {!expanded && truncated && <Image pointerEvents="none" source={{ uri: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}` }} style={{ position: 'absolute', right: 0, bottom: 0, width: 72, height: lineHeight }} />}
  </View>;
}
const s = StyleSheet.create({ measure: { position: 'absolute', top: 0, left: 0, right: 0, opacity: 0 } });
