import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/shared/theme';

type Props = {
  title: string;
  author: string;
  label: string;
  color: string;
  onPress?: () => void;
  onDetails?: () => void;
  hoverDetails?: boolean;
  width?: number; // 表紙の幅。高さは幅の1.5倍（狭い画面でも1段に3冊並べるため）
};

// React Native の文字は縦書きにできないので、1文字ずつ改行して縦に並べる
const vertical = (text: string) => Array.from(text).join('\n');

// 長い題名は1列に収まらないので、右から順に複数の列へ折り返す
const TITLE_PER_COLUMN = 6;
const columns = (text: string) => {
  const chars = Array.from(text);
  const out: string[] = [];
  for (let i = 0; i < chars.length; i += TITLE_PER_COLUMN) out.push(chars.slice(i, i + TITLE_PER_COLUMN).join(''));
  return out;
};

// 著者名が長いと表紙を埋めてしまうので、先頭だけ見せる
const AUTHOR_MAX = 9;
const shortAuthor = (text: string) => {
  const chars = Array.from(text.split(/[（(・]/)[0].trim());
  return chars.length > AUTHOR_MAX ? chars.slice(0, AUTHOR_MAX).join('') + '…' : chars.join('');
};

export function Cover({ title, author, label, color, onPress, onDetails, hoverDetails = false, width = 112 }: Props) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const showDetails = hovered || focused;
  return (
    <View style={{ width, height: width * 1.5 }} onPointerEnter={() => setHovered(true)} onPointerLeave={() => setHovered(false)}>
    <Pressable accessibilityRole={onPress ? "button" : undefined} accessibilityLabel={onPress ? `${title}を読む` : undefined} accessibilityHint={onDetails && !hoverDetails ? '長押しで本の紹介を開きます' : undefined} onPress={onPress} onLongPress={hoverDetails ? undefined : onDetails} delayLongPress={450} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} style={({ pressed }) => [styles.cover, { width, height: width * 1.5, backgroundColor: color }, pressed && styles.pressed]}>
      <View style={styles.spine} />
      <View style={styles.face}>
        {columns(title).map((col, i) => (
          <Text key={i} style={styles.title}>{vertical(col)}</Text>
        ))}
        <Text style={styles.author}>{vertical(shortAuthor(author))}</Text>
      </View>
      <Text style={styles.tag}>{label}</Text>
    </Pressable>
    {onDetails && hoverDetails && <Pressable accessibilityRole="button" accessibilityLabel={`${title}の紹介を開く`} onPress={onDetails} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} pointerEvents={showDetails ? 'auto' : 'none'} style={[styles.details, { opacity: showDetails ? 1 : 0 }]}><Text style={styles.dots}>…</Text></Pressable>}
    </View>
  );
}

const styles = StyleSheet.create({
  details: { position: 'absolute', top: -3, right: -3, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.68)', alignItems: 'center', justifyContent: 'center', zIndex: 2, boxShadow: '0 1px 5px rgba(0,0,0,0.12)' },
  dots: { color: colors.ink, fontSize: 15, fontWeight: '700', lineHeight: 18, marginTop: -4 },
  cover: {
    width: 112,
    height: 168,
    borderTopLeftRadius: 2,
    borderBottomLeftRadius: 2,
    borderTopRightRadius: 5,
    borderBottomRightRadius: 5,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  pressed: { transform: [{ translateY: -4 }] },
  // 背の部分を暗くして立体感を出す
  spine: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 8, backgroundColor: 'rgba(0,0,0,0.22)' },
  face: { flex: 1, flexDirection: 'row-reverse', gap: 6, paddingTop: 14, paddingRight: 12, paddingLeft: 16 },
  title: { color: '#FDFBF5', fontSize: 15, lineHeight: 19, textAlign: 'center' },
  author: { color: '#FDFBF5', fontSize: 10, lineHeight: 13, opacity: 0.78, textAlign: 'center' },
  tag: {
    position: 'absolute',
    left: 16,
    bottom: 10,
    fontSize: 9,
    color: '#FDFBF5',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
    borderRadius: 20,
    paddingHorizontal: 7,
    paddingVertical: 2,
    overflow: 'hidden',
  },
});
