import { createAozoraService } from '../../server/aozora.mjs';

const aozora = createAozoraService({ cachePath: '.local/aozora/catalog.zip' });

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  try {
    const id = params.get('id');
    if (id !== null) {
      if (!/^\d{1,8}$/.test(id) || Number(id) === 0) return Response.json({ error: '作品を選び直してください。' }, { status: 400 });
      return Response.json(await aozora.importBook(Number(id)));
    }
    const query = (params.get('q') ?? '').trim(), field = params.get('field') ?? 'keyword';
    const page = Number(params.get('page') ?? '1');
    if (!query || query.length > 80 || !['keyword', 'title', 'author'].includes(field) || !Number.isInteger(page) || page < 1 || page > 2000) {
      return Response.json({ error: '検索語を1〜80文字で入力して再検索してください。' }, { status: 400 });
    }
    return Response.json(await aozora.search(query, field, page));
  } catch (error) {
    console.error('青空文庫の取得に失敗しました。', error);
    return Response.json({ error: '作品を取得できません。通信を確認し、時間をおいて再試行してください。' }, { status: 502 });
  }
}
