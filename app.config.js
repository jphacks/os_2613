// app.json の内容に、公開リポジトリへ書きたくない値だけを環境変数から足す。
// Apple の Team ID や Expo のアカウント名は個人に紐づくため、コードには書かない。
// 手元では .env（コミットしない）に置き、EAS のビルドでは EAS の環境変数から渡す。
module.exports = ({ config }) => ({
  ...config,
  ...(process.env.EXPO_OWNER ? { owner: process.env.EXPO_OWNER } : {}),
  ios: {
    ...config.ios,
    appleTeamId: process.env.APPLE_TEAM_ID,
  },
  plugins: [...config.plugins, '@bacons/apple-targets'],
});
