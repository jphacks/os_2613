import test from 'node:test';
import assert from 'node:assert/strict';
import { characterPassages, graphFromPassages, relationshipPassages, relationshipsFromPassages } from '../src/features/characters/model.mjs';
import { characterLayout } from '../src/features/characters/layout.mjs';

test('関係の根拠が240文字を越えても資料IDから原文を復元し、未読の情報は補わない', () => {
  const text = '太郎は橋へ来た。' + '雨が降っていた。'.repeat(45) + '花子は太郎の友人だった。😀';
  const value = { people: [{ id: 'a', name: '太郎', sourceId: 's1' }, { id: 'b', name: '花子', sourceId: 's1' }], relations: [{ from: 'a', to: 'b', label: '友人', sourceId: 's1' }] };
  const graph = graphFromPassages(value, text);
  assert.equal(graph.people.length, 2); assert.equal(graph.relations.length, 1);
  assert.ok(graph.relations[0].quote.length > 240);
  assert.equal(text.slice(graph.relations[0].start, graph.relations[0].end), graph.relations[0].quote);
  assert.ok(graph.people.every(item => item.quote.length <= 120));
  assert.throws(() => graphFromPassages({ ...value, people: [{ id: 'c', name: '未来の王女', sourceId: 's1' }] }, text), /UNGROUNDED/);
  assert.equal(graphFromPassages({ ...value, relations: [{ ...value.relations[0], sourceId: 'unknown' }] }, text).relations.length, 0);
  assert.equal(graphFromPassages({ ...value, relations: [{ ...value.relations[0], label: '兄妹' }] }, text).relations.length, 0);
});

test('1人の名前・資料IDが不一致でも、確認できた人物と関係を失わない', () => {
  const text = '太郎と花子は友人だった。';
  const people = [{ id: 'a', name: '太郎', sourceId: 's1' }, { id: 'b', name: '花子', sourceId: 's1' }, { id: 'c', name: '王女花子', sourceId: 's1' }, { id: 'd', name: '太郎', sourceId: 'unknown' }];
  const result = graphFromPassages({ people, relations: [{ from: 'a', to: 'b', label: '友人', sourceId: 's1' }, { from: 'a', to: 'c', label: '友人', sourceId: 's1' }] }, text);
  assert.deepEqual(result.people.map(item => item.name), ['太郎', '花子']);
  assert.equal(result.relations.length, 1);
  assert.throws(() => graphFromPassages({ people: [people[2], people[3]], relations: [] }, text), error => {
    assert.equal(error.message, 'UNGROUNDED'); assert.equal(error.cause.names, 1); assert.equal(error.cause.sourceIds, 1); return true;
  });
  assert.deepEqual(graphFromPassages({ people: [], relations: [] }, text), { people: [], relations: [] });
});

test('資料の区切りは絵文字を分断せず、しおりまでの全文を覆う', () => {
  const text = '文😀'.repeat(2000), sources = characterPassages(text);
  assert.ok(sources.length > 1);
  for (const source of sources) { assert.ok(text.includes(source.quote)); assert.ok(source.quote.length <= 1200); assert.ok(!/[\uDC00-\uDFFF]/.test(source.quote[0])); assert.ok(!/[\uD800-\uDBFF]/.test(source.quote.at(-1))); }
  assert.ok(text.endsWith(sources.at(-1).quote));
});

test('確認済み人物の関係を別資料から復元し、別の組・未読の関係は採用しない', () => {
  const text = '太郎と花子は竹馬の友だった。' + '静かな日だった。'.repeat(180) + '花子の弟子は次郎である。😀';
  const rawPeople = [ ['a', '太郎'], ['b', '花子'], ['c', '次郎'] ].map(([id, name]) => ({ id, name, quote: text.slice(text.indexOf(name), text.indexOf(name) + 30) }));
  const people = rawPeople;
  const sources = relationshipPassages(text, people);
  const friendship = sources.find(item => item.from === 'a' && item.to === 'b' && item.quote.includes('竹馬の友'));
  const disciple = sources.find(item => item.from === 'b' && item.to === 'c' && item.quote.includes('弟子'));
  assert.ok(friendship); assert.ok(disciple);
  assert.ok(sources.every(item => item.quote.length <= 1200 && text.includes(item.quote)));
  const result = relationshipsFromPassages({ relations: [
    { from: 'a', to: 'b', label: '竹馬の友', sourceId: friendship.id },
    { from: 'c', to: 'b', label: '弟子', sourceId: disciple.id },
    { from: 'a', to: 'c', label: '弟子', sourceId: disciple.id },
    { from: 'a', to: 'b', label: '将来の敵', sourceId: friendship.id },
    { from: 'a', to: 'b', label: '友', sourceId: 'unknown' },
  ] }, text, people, sources);
  assert.deepEqual(result.relations.map(item => item.label), ['竹馬の友', '弟子']);
  assert.ok(result.relations.every(item => text.slice(item.start, item.end) === item.quote));
  const prefix = text.slice(0, 500);
  assert.ok(!relationshipPassages(prefix, people.slice(0, 2)).some(item => item.quote.includes('弟子')));
});

test('図は同じ人物を一度だけ配置し、孤立人物も残して、検証済みの関係だけを結ぶ', () => {
  for (const count of [1, 2, 5, 8]) {
    const people = Array.from({ length: count }, (_, index) => ({ id: `p${index}`, name: `人物${index}` }));
    const relations = people.slice(1, -1).map(item => ({ from: 'p0', to: item.id, label: '友人' }));
    const layout = characterLayout({ people, relations });
    assert.equal(layout.nodes.length, count); assert.equal(layout.edges.length, relations.length);
    assert.equal(new Set(layout.nodes.map(node => `${node.x}:${node.y}`)).size, count);
    for (const node of layout.nodes) { assert.ok(node.x >= 50 && node.x <= layout.width - 50); assert.ok(node.y >= 54 && node.y <= layout.height - 54); }
    for (const edge of layout.edges) {
      assert.ok(Number.isFinite(edge.angle)); assert.ok(edge.length > 0);
      assert.ok(Math.abs(edge.labelAngle) <= Math.PI / 2);
      if (edge.labelVertical) { assert.equal(edge.labelAngle, 0); assert.equal(edge.labelWidth, 24); }
      else { assert.ok(Math.abs(Math.sin(edge.angle - edge.labelAngle)) < 1e-10); assert.ok(edge.labelWidth >= 48 && edge.labelWidth <= 240); }
    }
  }
});

test('同じ2人の順方向・逆方向の関係は、別々の平行な矢印に配置する', () => {
  const layout = characterLayout({ people: [{ id: 'a', name: '人物A' }, { id: 'b', name: '人物B' }], relations: [
    { from: 'a', to: 'b', label: '友人' }, { from: 'b', to: 'a', label: '約束' },
  ] });
  assert.notEqual(layout.edges[0].y, layout.edges[1].y);
  assert.equal(layout.edges[0].labelAngle, 0); assert.equal(layout.edges[1].labelAngle, 0);
  assert.notEqual(layout.edges[0].labelY, layout.edges[1].labelY);
});

test('上下の矢印は文字を回転せず上から下へ縦書きし、横の矢印は横書きする', () => {
  const people = Array.from({ length: 5 }, (_, index) => ({ id: `p${index}`, name: `人物${index}` }));
  const relations = people.slice(1).map(item => ({ from: 'p0', to: item.id, label: '「友人」である。'.repeat(5) }));
  const layout = characterLayout({ people, relations });
  const vertical = layout.edges.filter(edge => edge.labelVertical), horizontal = layout.edges.filter(edge => !edge.labelVertical);
  assert.equal(vertical.length, 2); assert.equal(horizontal.length, 2);
  assert.ok(vertical.some(edge => edge.angle < 0)); assert.ok(vertical.some(edge => edge.angle > 0));
  for (const edge of vertical) {
    assert.equal(edge.labelAngle, 0); assert.ok(edge.labelText.startsWith('﹁\n友\n人\n﹂'));
    assert.ok(edge.labelText.endsWith('︙')); assert.ok(edge.labelHeight <= edge.length);
    assert.equal(edge.label, relations[0].label);
  }
  for (const edge of horizontal) { assert.equal(edge.labelText, edge.label); assert.ok(!edge.labelText.includes('\n')); }
});
