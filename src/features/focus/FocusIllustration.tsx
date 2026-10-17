import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';

// 読書集中モードの設定手順ごとに、iPhone の実際の設定画面のスクリーンショット（切り抜き）を見せる。
// 画像は assets/focus/ にあり、幅600pxに縮めてある。枠や背景は付けず、画像の角だけを少し丸める。

const shots = {
  list: { source: require('../../../assets/focus/step1-list.png'), ratio: 600 / 621, label: '集中モードの一覧。右上の＋と「読書」' },
  silence: { source: require('../../../assets/focus/step2-silence.png'), ratio: 600 / 380, label: '「通知を知らせない」にチェックが付いた画面' },
  apps: { source: require('../../../assets/focus/step3-apps.png'), ratio: 600 / 352, label: '通知を知らせないアプリを追加した画面' },
  schedule: { source: require('../../../assets/focus/step5-schedule.png'), ratio: 600 / 366, label: 'スケジュールを設定の画面' },
} as const;

export type FocusShot = keyof typeof shots;

export function FocusIllustration({ shot }: { shot: FocusShot }) {
  const { source, ratio, label } = shots[shot];
  // 入れ物の実際の幅を測り、その幅と縦横比から高さを決める（上下に余白を作らない）
  const [width, setWidth] = useState(0);
  return <View style={s.box} onLayout={e => setWidth(e.nativeEvent.layout.width)}>
    {width > 0 && <Image source={source} accessibilityLabel={`設定画面：${label}`} resizeMode="cover" style={[s.image, { width, height: width / ratio }]} />}
  </View>;
}

const s = StyleSheet.create({
  box: { width: '100%', maxWidth: 360, marginTop: 10 },
  image: { borderRadius: 12 },
});
