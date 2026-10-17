import { FocusIllustration } from '@/features/focus/FocusIllustration';
import { openFocusSettings } from '@/features/focus/openFocusSettings';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/shared/theme';

// 「読書集中モード」の設定方法を案内する画面。
// iOS ではアプリが集中モードを作ったりオンにしたりできないため、
// iPhone の設定にある「アプリを開いたら集中モードを自動でオンにする」機能の使い方を説明する。
// 一度設定すると、ドパBOOKs を開いている間だけ通知が届かなくなる。

const steps = [
  { title: '設定アプリを開く', text: '下のボタンから、または iPhone の「設定」を開きます。' },
  { title: '「集中モード」→ 右上の「＋」', text: '「カスタム」を選び、名前を「読書」にします。本のアイコンを選ぶと分かりやすくなります。' },
  { title: '通知を許可する相手を選ぶ', text: '「通知を許可」で、読書中も受け取りたい人やアプリだけを残します。「通知を許可する」を選び、必要な相手・アプリだけ追加します。タイムセンシティブ通知や繰り返しの着信なども必要に応じて見直してください。' },
  { title: '「自動的にオン」→「App」→ ドパBOOKs', text: '「スケジュールを追加」（または「自動的にオン」）から「App」→「ドパBOOKs」を選びます。設定後にアプリを開いて、集中モードが有効になるか確認してください。' },
];

export default function FocusScreen() {
  const ios = Platform.OS === 'ios';
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.body}>
      <Text style={styles.eyebrow}>FOCUS</Text>
      <Text style={styles.title}>読書集中モード</Text>
      <Text style={styles.lead}>読んでいる間に通知が来ると、せっかくの集中が途切れてしまいます。iPhone の集中モードを使うと、ドパBOOKs を開いている間だけ通知を止められます。</Text>

      <View style={styles.card}>
        {steps.map((step, i) => (
          <View key={step.title} style={styles.step}>
            <View style={styles.number}><Text style={styles.numberText}>{i + 1}</Text></View>
            <View style={styles.stepBody}>
              <Text style={styles.stepTitle}>{step.title}</Text>
              <Text style={styles.note}>{step.text}</Text>
              <FocusIllustration step={i} />
            </View>
          </View>
        ))}
      </View>

      {ios ? (
        <Pressable style={styles.button} onPress={() => void openFocusSettings()}>
          <Text style={styles.buttonText}>設定アプリを開く</Text>
        </Pressable>
      ) : (
        <Text style={styles.note}>この設定は iPhone で行います。iPhone の「設定」→「集中モード」から設定してください。</Text>
      )}
      <Text style={styles.note}>※ 集中モードの設定は iPhone 側で行うため、アプリから勝手にオンにすることはありません。</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  body: { padding: 20, paddingBottom: 48, gap: 16, width: '100%', maxWidth: 640, alignSelf: 'center' },
  eyebrow: { fontSize: 10, letterSpacing: 1.8, color: colors.accent, fontWeight: '700' },
  title: { fontSize: 28, color: colors.ink, marginTop: -8 },
  lead: { fontSize: 14, color: colors.ink, lineHeight: 24 },
  note: { fontSize: 13, color: colors.muted, lineHeight: 22 },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 16, gap: 18 },
  step: { flexDirection: 'row', gap: 12 },
  number: { width: 26, height: 26, borderRadius: 13, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
  numberText: { color: colors.accent, fontSize: 12 },
  stepBody: { flex: 1, gap: 4 },
  stepTitle: { fontSize: 15, color: colors.ink, fontWeight: '600' },
  button: { backgroundColor: colors.accent, borderRadius: 999, padding: 14, alignItems: 'center' },
  buttonText: { color: colors.surface, fontSize: 15 },
});
