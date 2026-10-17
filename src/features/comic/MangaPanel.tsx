import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Balloon, ComicPanel } from './model.mjs';

function BalloonText({ balloon, fontSize }: { balloon: Balloon; fontSize: number }) {
  if (balloon.kind === 'narration') return <Text style={{ color: '#111', fontSize, lineHeight: fontSize * 1.5, fontWeight: '600' }}>{balloon.text}</Text>;
  const letters = [...balloon.text], columns: string[][] = [];
  for (let i = 0; i < letters.length; i += 7) columns.push(letters.slice(i, i + 7));
  return <View accessible accessibilityLabel={`${balloon.speaker}：${balloon.text}`} style={styles.columns}>
    {columns.map((column, index) => <View key={index}>{column.map((letter, row) => <View key={row} accessible={false} style={{ width: fontSize * 1.15, height: fontSize * 1.3, alignItems: 'center', justifyContent: 'center' }}>
      <Text allowFontScaling={false} style={{ color: '#111', fontSize, lineHeight: fontSize * 1.3, fontWeight: '600', transform: /[ー―…「」『』（）]/.test(letter) ? [{ rotate: '90deg' }] : undefined }}>{letter}</Text>
    </View>)}</View>)}
  </View>;
}

export function MangaPanel({ panel, index, width, children }: { panel: ComicPanel; index: number; width: number; children: ReactNode }) {
  const fontSize = Math.max(14, Math.min(20, Math.round(width * 0.045)));
  return <View style={styles.frame}>
    <View style={StyleSheet.absoluteFill}>{children}</View>
    {(panel.balloons ?? []).map(balloon => {
      const narration = balloon.kind === 'narration', thought = balloon.kind === 'thought';
      return <View key={balloon.slot} style={[
        styles.balloon, narration ? styles.narration : styles.speech,
        balloon.slot === 'left' && styles.left, balloon.slot === 'right' && styles.right,
        thought && styles.thought,
      ]}>
        {!narration && <Text style={{ fontSize: Math.max(9, fontSize * 0.6), color: '#444', fontWeight: '700', textAlign: 'center', marginBottom: 4 }}>{balloon.speaker}</Text>}
        <BalloonText balloon={balloon} fontSize={fontSize} />
        {!narration && (thought ? <View accessible={false} style={[styles.thoughtTail, balloon.slot === 'right' ? { left: 15 } : { right: 15 }]}><View style={styles.thoughtDot} /><View style={[styles.thoughtDot, { width: 6, height: 6, marginTop: 3 }]} /></View> : <>
          <View accessible={false} style={[styles.tailEdge, balloon.slot === 'right' ? { left: 16 } : { right: 16 }]} />
          <View accessible={false} style={[styles.tailFill, balloon.slot === 'right' ? { left: 18 } : { right: 18 }]} />
        </>)}
      </View>;
    })}
    <Text accessibilityLabel={`${index + 1}コマ目：${panel.title}`} style={styles.number}>{index + 1}</Text>
  </View>;
}

const styles = StyleSheet.create({
  frame: { width: '100%', aspectRatio: 2 / 3, borderWidth: 2, borderColor: '#151515', backgroundColor: '#fff', overflow: 'hidden' },
  balloon: { position: 'absolute', backgroundColor: '#fff', borderColor: '#111', borderWidth: 2 },
  speech: { top: '3%', paddingHorizontal: 10, paddingVertical: 15, borderRadius: 36, maxWidth: '44%' },
  left: { left: '3%' }, right: { right: '3%' },
  narration: { bottom: '4%', left: '4%', right: '4%', padding: 10 },
  thought: { borderStyle: 'dashed', borderRadius: 42 }, columns: { flexDirection: 'row-reverse', gap: 2 },
  tailEdge: { position: 'absolute', bottom: -17, width: 0, height: 0, borderTopWidth: 18, borderTopColor: '#111', borderLeftWidth: 6, borderLeftColor: 'transparent', borderRightWidth: 6, borderRightColor: 'transparent' },
  tailFill: { position: 'absolute', bottom: -12, width: 0, height: 0, borderTopWidth: 14, borderTopColor: '#fff', borderLeftWidth: 4, borderLeftColor: 'transparent', borderRightWidth: 4, borderRightColor: 'transparent' },
  thoughtTail: { position: 'absolute', bottom: -26, alignItems: 'center' }, thoughtDot: { width: 10, height: 10, borderWidth: 1, borderColor: '#111', borderRadius: 8, backgroundColor: '#fff' },
  number: { position: 'absolute', bottom: 1, right: 3, color: '#111', backgroundColor: '#fff', fontSize: 10, paddingHorizontal: 3 },
});
