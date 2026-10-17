import { Linking } from 'react-native';

// 設定アプリを開く（読書集中モードを作ってもらうため）。
// まず集中モードの画面を直接開こうとし、開けない iOS の版ではこのアプリの設定画面を開く。
export async function openFocusSettings() {
  try {
    await Linking.openURL('App-prefs:FOCUS');
  } catch {
    await Linking.openSettings();
  }
}
