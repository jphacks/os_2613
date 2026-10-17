import { FocusIllustration, type FocusShot } from '@/features/focus/FocusIllustration';
import { openFocusSettings } from '@/features/focus/openFocusSettings';
import { useAccount } from '@/features/account/AccountProvider';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/shared/theme';

// 「読書集中モード」の設定方法を案内する画面。
// iOS ではアプリが集中モードを作ったりオンにしたりできないため、
// iPhone の設定にある「アプリを開いたら集中モードを自動でオンにする」機能の使い方を説明する。
// 一度設定すると、ドパBOOKs を開いている間だけ通知が届かなくなる。

// 手順は iOS の実際の画面（設定 → 集中モード）の並びに合わせる。各手順に図（FocusIllustration）が付く。
const steps: { shot: FocusShot; title: string; text: string }[] = [
  { shot: 'list', title: '「読書」の集中モードを作る', text: '設定 →「集中モード」を開き、右上の「＋」→「カスタム」。名前を「読書」にして、本のアイコンを選ぶと、一覧に「読書」が増えます。' },
  { shot: 'silence', title: '「通知を知らせない」を選ぶ', text: '「読書」を開き、「通知を知らせない」の「アプリ」を押します。上の「通知を知らせない」にチェックが付いていることを確かめます。' },
  { shot: 'apps', title: '通知を止めたいアプリを追加する', text: '「追加」を押して、BeReal・Instagram・LINE・X・YouTube など、読書中に通知が来てほしくないアプリを選びます。選んだアプリの通知は、通知センターに静かに届きます。' },
  { shot: 'schedule', title: 'ドパBOOKs を開いたら自動でオン', text: '下にある「スケジュールを設定」の「スケジュールを追加」→「App」→「ドパBOOKs」を選びます。これで、ドパBOOKs を開くと自動でオンになり、閉じるとオフに戻ります。' },
];

export default function FocusScreen() {
  const ios = Platform.OS === 'ios';
  const { complete } = useAccount();
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
              <FocusIllustration shot={step.shot} />
            </View>
          </View>
        ))}
      </View>

      {ios ? (
        <Pressable style={styles.button} onPress={() => { complete('focus') /* 読書クエスト「通知オフ」 */; void openFocusSettings(); }}>
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
  body: { padding: 20, paddingBottom: 48, gap: 16, width: '100%' },
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
