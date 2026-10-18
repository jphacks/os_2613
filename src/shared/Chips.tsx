import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/shared/theme';

type Item = { id: string; label: string };

type Props = {
  items: Item[];
  value: string;
  onChange: (id: string) => void;
  // sub は2段目の絞り込み用。1段目より控えめにして階層が分かるようにする
  variant?: 'main' | 'sub' | 'segment';
};

export function Chips({ items, value, onChange, variant = 'main' }: Props) {
  const segment = variant === 'segment';
  return (
    <View style={[styles.row, segment && styles.segmentRow]}>
      {items.map(item => {
        const on = item.id === value;
        return (
          <Pressable
            key={item.id}
            onPress={() => onChange(item.id)}
            style={[
              styles.chip,
              variant === 'sub' && styles.chipSub,
              segment && styles.segment,
              on && (variant === 'sub' ? styles.onSub : styles.on),
            ]}
          >
            <Text style={[styles.text, variant === 'sub' && styles.textSub, on && styles.textOn]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  segmentRow: { backgroundColor: colors.line, flexWrap: 'nowrap', gap: 3, padding: 3, borderRadius: 999, overflow: 'hidden' },
  chip: { paddingHorizontal: 13, paddingVertical: 7, borderRadius: 20, backgroundColor: colors.button },
  chipSub: { paddingHorizontal: 11, paddingVertical: 6, backgroundColor: colors.button },
  segment: { flex: 1, alignItems: 'center', borderWidth: 0, backgroundColor: 'transparent', borderRadius: 999, paddingVertical: 10 },
  on: { backgroundColor: colors.accent, borderColor: colors.accent },
  onSub: { backgroundColor: colors.ink, borderColor: colors.ink },
  text: { fontSize: 12, color: colors.ink },
  textSub: { fontSize: 11 },
  textOn: { color: colors.surface, fontWeight: '600' },
});
