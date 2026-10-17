// Chapter starts checked against the printed tables of contents (PDF page numbers).
const contents = {
  calculus: [[1, '0 序'], [6, '1 実数'], [16, '2 極限と連続 I'], [34, '3 初等関数 I'], [42, '4 極限と連続 II'], [49, '5 微分 I'], [67, '6 初等関数 II'], [78, '7 積分の基礎'], [98, '8 微積分の基本公式とその応用'], [111, '9 広義積分'], [134, '10 収束の一様性'], [157, '11 多変数関数の微分'], [183, '12 多変数関数の積分計算'], [201, '13 付録'], [209, '14 問の略解']],
  thermodynamics: [[1, '前付・目次'], [5, '1 序章'], [12, '2 熱力学的状態と温度'], [16, '3 熱力学第一法則'], [26, '4 熱力学第二法則'], [41, '5 熱力学関数'], [54, '6 熱平衡条件と安定性'], [65, '7 相と相転移'], [79, '8 開いた系と混合系'], [93, '9 補足']],
  'mathematics-for-economics': [[1, '目次'], [3, '1 微分法'], [21, '2 線形代数'], [52, '3 凸解析']],
};
export async function chapterIndex(document, id) {
  let starts = contents[id]?.map(([firstPage, title]) => ({ firstPage, title }));
  if (!starts) {
    starts = [{ firstPage: 1, title: '表紙・前付' }];
    async function visit(items) {
      for (const item of items ?? []) {
        const dest = typeof item.dest === 'string' ? await document.getDestination(item.dest) : item.dest;
        if (dest) {
          const firstPage = typeof dest[0] === 'number' ? dest[0] + 1 : await document.getPageIndex(dest[0]) + 1;
          starts.push({ firstPage, title: item.title + (item.items.length ? '（導入）' : '') });
        }
        await visit(item.items);
      }
    }
    await visit(await document.getOutline());
  }
  starts.sort((a, b) => a.firstPage - b.firstPage);
  starts = starts.filter((item, i) => starts[i + 1]?.firstPage !== item.firstPage);
  return starts.map((item, index) => ({ ...item, index, lastPage: (starts[index + 1]?.firstPage ?? document.numPages + 1) - 1 }));
}
