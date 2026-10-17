// 図の座標だけを決める。人物・関係の内容は追加しない。
export function characterLayout(graph) {
  const width = graph.people.length <= 2 ? 720 : 900, height = graph.people.length <= 2 ? 320 : 720;
  const degree = id => graph.relations.filter(item => item.from === id || item.to === id).length;
  const ordered = [...graph.people].sort((a, b) => degree(b.id) - degree(a.id));
  const hub = ordered.length >= 3 && degree(ordered[0].id) >= 2 ? ordered[0].id : null;
  const ring = ordered.filter(item => item.id !== hub);
  const nodes = graph.people.map(item => {
    const index = ring.findIndex(node => node.id === item.id);
    const angle = index * 2 * Math.PI / Math.max(1, ring.length) - Math.PI / 2;
    const centered = item.id === hub || graph.people.length === 1;
    const x = centered ? width / 2 : graph.people.length === 2 ? 180 + index * 360 : width / 2 + Math.cos(angle) * 330;
    const y = centered || graph.people.length === 2 ? height / 2 : height / 2 + Math.sin(angle) * 270;
    return { ...item, x, y };
  });
  const labels = [];
  const edges = graph.relations.map((item, index) => {
    const a = nodes.find(node => node.id === item.from), b = nodes.find(node => node.id === item.to);
    const dx = b.x - a.x, dy = b.y - a.y, distance = Math.hypot(dx, dy), ux = dx / distance, uy = dy / distance;
    const angle = Math.atan2(dy, dx);
    const labelVertical = Math.abs(uy) >= Math.cos(Math.PI / 12);
    const labelAngle = labelVertical ? 0 : angle > Math.PI / 2 ? angle - Math.PI : angle < -Math.PI / 2 ? angle + Math.PI : angle;
    const siblings = graph.relations.map((relation, position) => ({ relation, position })).filter(({ relation }) =>
      (relation.from === item.from && relation.to === item.to) || (relation.from === item.to && relation.to === item.from));
    const lane = (siblings.findIndex(entry => entry.position === index) - (siblings.length - 1) / 2) * 32;
    // 逆向きの関係も同じ基準の法線を使い、別々の平行線に配置する。
    const direction = item.from < item.to ? 1 : -1, normalX = -uy * direction, normalY = ux * direction;
    const inset = Math.min(100, Math.min(58 / Math.max(Math.abs(ux), 0.001), 62 / Math.max(Math.abs(uy), 0.001)));
    const length = Math.max(0, distance - inset * 2);
    const characters = [...item.label];
    const verticalLimit = Math.max(1, Math.floor((Math.min(240, Math.max(26, length - 18)) - 8) / 18));
    const verticalCharacters = characters.length > verticalLimit ? [...characters.slice(0, verticalLimit - 1), '︙'] : characters;
    const punctuation = { '、': '︑', '。': '︒', '「': '﹁', '」': '﹂', '『': '﹃', '』': '﹄', '（': '︵', '）': '︶', 'ー': '丨', '…': '︙' };
    const labelText = labelVertical ? verticalCharacters.map(character => punctuation[character] ?? character).join('\n') : item.label;
    const labelWidth = labelVertical ? 24 : Math.min(240, Math.max(48, length - 18), Math.max(48, characters.length * 13 + 16));
    const labelHeight = labelVertical ? verticalCharacters.length * 18 + 8 : 24;
    const halfWidth = (Math.abs(Math.cos(labelAngle)) * labelWidth + Math.abs(Math.sin(labelAngle)) * labelHeight) / 2;
    const halfHeight = (Math.abs(Math.sin(labelAngle)) * labelWidth + Math.abs(Math.cos(labelAngle)) * labelHeight) / 2;
    let label, bestScore = Infinity;
    for (const fraction of [0.5, 0.38, 0.62]) for (const offset of [-15, 15, -31, 31]) {
      const x = a.x + dx * fraction + normalX * (lane + offset), y = a.y + dy * fraction + normalY * (lane + offset);
      const overlaps = (other, w, h) => Math.max(0, halfWidth + w - Math.abs(x - other.x)) * Math.max(0, halfHeight + h - Math.abs(y - other.y));
      const score = nodes.reduce((sum, node) => sum + overlaps(node, 56, 60) * 4, 0) + labels.reduce((sum, other) => sum + overlaps(other, other.halfWidth + 4, other.halfHeight + 4), 0);
      if (score < bestScore) { bestScore = score; label = { x, y, halfWidth, halfHeight }; }
    }
    labels.push(label);
    return { ...item, x: a.x + ux * inset + normalX * lane, y: a.y + uy * inset + normalY * lane, length, angle, labelX: label.x, labelY: label.y, labelAngle, labelWidth, labelHeight, labelVertical, labelText };
  });
  return { width, height, nodes, edges };
}
