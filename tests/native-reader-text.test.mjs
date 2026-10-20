import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
// react-native-webviewのiOS実装と同じ、テンプレート文字列へのJSON埋め込みを再現する。
function injectedObject(value) {
  return vm.runInNewContext('`' + JSON.stringify(value) + '`');
}
test('未変換の本文はiOSの初期JSON埋め込みで改行が壊れることを再現する', () => {
  assert.throws(() => JSON.parse(injectedObject({ text: 'メロスは激怒した。\n必ず、かの邪智暴虐の王を除かなければならぬ。' })), SyntaxError);
});
test('安全な形式の本文は改行・引用符・記号・絵文字を欠落なく復元できる', () => {
  const text = 'メロスは激怒した。\n"引用"\\記号\t`コード` ${1+2} 🐈\r\n次の段落';
  const received = JSON.parse(injectedObject({ text: encodeURIComponent(text), textEncoded: true }));
  assert.equal(decodeURIComponent(received.text), text);
});
