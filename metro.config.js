const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// 教材のPDFをアプリに同梱して読み込めるようにする
config.resolver.assetExts.push('pdf');

module.exports = config;
