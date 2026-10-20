import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { domBootstrap } from '../src/features/reader/dom-bootstrap.mjs';
function run(window) { window.addEventListener = () => {}; vm.runInNewContext(domBootstrap, { window, document: { addEventListener() {}, body: null }, setTimeout() {} }); delete window.addEventListener; }
test('DOM起動前に公式ブリッジのOSと本文propsを復元する', () => {
  const window = { ReactNativeWebView: { injectedObjectJson: () => JSON.stringify({ EXPO_DOM_HOST_OS: 'ios', initialProps: { props: { text: '本文' }, names: ['onReady'] } }) } };
  run(window);
  assert.equal(window.$$EXPO_DOM_HOST_OS, 'ios');
  assert.equal(window.$$EXPO_INITIAL_PROPS.props.text, '本文');
  assert.deepEqual(Array.from(window.$$EXPO_INITIAL_PROPS.names), ['onReady']);
});
test('Webと既に初期化済みのDOMは書き換えない', () => {
  const plain = {}; run(plain); assert.deepEqual(plain, {});
  const existing = { props: { text: '更新済み本文' }, names: [] };
  const window = { $$EXPO_DOM_HOST_OS: 'ios', $$EXPO_INITIAL_PROPS: existing, ReactNativeWebView: { injectedObjectJson: () => JSON.stringify({ EXPO_DOM_HOST_OS: 'android', initialProps: {} }) } };
  run(window);
  assert.equal(window.$$EXPO_DOM_HOST_OS, 'ios'); assert.equal(window.$$EXPO_INITIAL_PROPS, existing);
});
