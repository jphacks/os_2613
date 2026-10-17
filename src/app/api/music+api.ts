import { createMusicService } from '../../server/music.mjs';

const search = createMusicService();
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const tracks = await search(params.get('mood') ?? 'calm', params.get('q') ?? undefined);
    return Response.json({ tracks });
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    const messages: Record<string, string> = {
      KEY: 'サーバーを停止し、npm start の起動時にFreesound APIキーを入力してください。',
      AUTH: 'Freesound APIキーを確認し、サーバーを停止して起動時に入力し直してください。',
      MOOD: '雰囲気を選び直してください。',
      QUERY: '検索語は半角英数字・空白・ハイフンの2〜100文字で入力してください。',
      LIMIT: 'Freesoundの利用上限です。時間をおいて再試行してください。',
    };
    return Response.json({ error: messages[code] ?? '音楽を取得できません。通信を確認して再試行してください。' }, { status: ['MOOD', 'QUERY'].includes(code) ? 400 : code === 'LIMIT' ? 429 : 503 });
  }
}
