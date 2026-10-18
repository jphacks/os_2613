const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// 教材のPDFをアプリに同梱して読み込めるようにする
config.resolver.assetExts.push('pdf');

// 公式Expo OAuth SDKは拡張子付きでプラットフォーム別ファイルを参照する。
// Metroでは拡張子を外して .native.js / .web.js の選択を有効にする。
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const origin = context.originModulePath.replace(/\\/g, '/');
  const target = origin.includes('/@atproto/oauth-client-expo/') && moduleName === './expo-oauth-client.js'
    ? './expo-oauth-client' : moduleName;
  return originalResolveRequest ? originalResolveRequest(context, target, platform) : context.resolveRequest(context, target, platform);
};

module.exports = config;
