// 開発用WebViewでHTMLの初期化より先にDOMバンドルが走る場合にも、公式ブリッジの初期propsを用意する。
export const domBootstrap = `
(function () {
  var bridge = window.ReactNativeWebView;
  if (!bridge || typeof bridge.injectedObjectJson !== 'function') return;
  try {
    var data = JSON.parse(bridge.injectedObjectJson());
    if (typeof window.$$EXPO_DOM_HOST_OS === 'undefined' && data.EXPO_DOM_HOST_OS) window.$$EXPO_DOM_HOST_OS = data.EXPO_DOM_HOST_OS;
    if (typeof window.$$EXPO_INITIAL_PROPS === 'undefined' && data.initialProps) window.$$EXPO_INITIAL_PROPS = data.initialProps;
  } catch (_) { /* 不正な初期値を捏造せず、Expoの初期化エラーに任せる。 */ }
})(); true;
`;
