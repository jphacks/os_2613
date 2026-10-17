const messages = {
  NOT_CONFIGURED: 'ふりかえりの準備ができていません。管理者に設定を確認してもらい、もう一度お試しください。',
  AUTH: 'ふりかえりの接続を確認できません。管理者に設定を確認してもらい、もう一度お試しください。',
  RATE_LIMIT: '現在ふりかえりを作れません。時間をおいて、管理者に利用状況を確認してもらってください。',
  BUSY: 'ほかのふりかえりを作成中です。少し待って、もう一度お試しください。',
  LIMIT: '現在の利用上限に達しました。管理者に利用状況を確認してもらい、もう一度お試しください。',
  TIMEOUT: 'ふりかえりの作成に時間がかかっています。少し時間をおいて、もう一度お試しください。',
  UNKNOWN: 'ふりかえりを取得できません。通信を確認し、少し時間をおいて再試行してください。',
};
// サーバーや外部サービスの文章を直接表示せず、許可した原因だけを使う。
export function summaryFailure(code) {
  const safe = typeof code === 'string' && Object.hasOwn(messages, code) ? code : 'UNKNOWN';
  return { code: safe, error: messages[safe] };
}
