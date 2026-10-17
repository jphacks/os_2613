const storageKey = 'dopabooks:library:v1';

export function isSavedBook(value) {
  if (!value || typeof value !== 'object') return false;
  return typeof value.id === 'string' && /^aozora-\d+$/.test(value.id) && Number.isSafeInteger(value.aozoraId)
    && ['title', 'author', 'subtitle', 'text', 'characters', 'cardUrl', 'htmlUrl', 'importedAt'].every(key => typeof value[key] === 'string');
}

export function createLibraryRepository(storage) {
  let books = [], loading;
  let writes = Promise.resolve();
  function load() {
    loading ??= (async () => {
      const saved = JSON.parse(await storage.getItem(storageKey) ?? '[]');
      if (!Array.isArray(saved) || !saved.every(isSavedBook)) throw new Error('本棚を読み込めません。端末の保存設定を確認してください。既存データは上書きしていません。');
      books = saved; return [...books];
    })();
    return loading;
  }
  function add(book) {
    const result = writes.then(async () => {
      await load();
      if (!isSavedBook(book)) throw new Error('作品データを確認できません。もう一度検索して追加してください。');
      if (books.some(item => item.id === book.id)) return [...books];
      const next = [...books, book];
      // 保存成功後にだけ一覧を更新し、同時追加でも直前の本を失わないようにする。
      await storage.setItem(storageKey, JSON.stringify(next));
      books = next; return [...books];
    });
    writes = result.catch(() => {});
    return result;
  }
  return { load, add };
}
