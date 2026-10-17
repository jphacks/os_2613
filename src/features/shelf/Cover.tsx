import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/shared/theme';

type Props = {
  title: string;
  author: string;
  label: string;
  color: string;
  onPress?: () => void;
};

// React Native の文字は縦書きにできないので、1文字ずつ改行して縦に並べる
const vertical = (text: string) => Array.from(text).join('\n');

export function Cover({ title, author, label, color, onPress }: Props) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.cover, { backgroundColor: color }, pressed && styles.pressed]}>
      <View style={styles.spine} />
      <View style={styles.face}>
        <Text style={styles.title}>{vertical(title)}</Text>
        <Text style={styles.author}>{vertical(author)}</Text>
      </View>
      <Text style={styles.tag}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
