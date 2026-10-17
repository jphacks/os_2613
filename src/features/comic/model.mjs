import { validOffset } from '../bookmark/model.mjs';
export const comicVersion = 2;
export function introPassages(opening) {
  const passages = []; let start = 0;
  while (start < opening.length) {
    let end = Math.min(opening.length, start + 180);
    if (!validOffset(opening, end)) end--;
    if (end < opening.length) {
      const stop = Math.max(opening.lastIndexOf('。', end - 1), opening.lastIndexOf('\n', end - 1));
      if (stop >= start) end = stop + 1;
    }
    const quote = opening.slice(start, end);
    if (quote.trim()) passages.push({ id: `s${passages.length + 1}`, quote, start, end });
    start = end;
  }
  return passages;
}
export function scriptFromPassages(value, opening) {
  const sources = introPassages(opening);
  if (!Array.isArray(value?.panels)) throw new Error('INVALID_RESULT');
  const panels = value.panels.map(panel => {
    const source = sources.find(item => item.id === panel?.sourceId);
    if (!source) throw new Error('UNGROUNDED');
    const balloons = value.format === 'manga-v2' ? panel.balloons?.map(balloon => {
      const evidence = sources.find(item => item.id === balloon?.sourceId);
      if (!evidence) throw new Error('UNGROUNDED');
      return { kind: balloon.kind, slot: balloon.slot, speaker: balloon.speaker, text: balloon.text, quote: evidence.quote, start: evidence.start, end: evidence.end };
    }) : undefined;
    return { title: panel.title, caption: panel.caption, scene: panel.scene, quote: source.quote, start: source.start, end: source.end, ...(balloons ? { balloons } : {}) };
  });
  return validateScript({ cast: value.cast, panels, ...(value.format ? { format: value.format } : {}) }, opening);
}
export function comicFailureMessage(code, hasScript, completed = 0) {
  const messages = {
    UNGROUNDED: '紹介内容に使う原文の根拠を確認できず、脚本の作成を止めました。もう一度お試しください。',
    NOT_CONFIGURED: '作成の準備が整っていません。起動時の接続設定を確認してください。',
    AUTH: '生成サービスへ接続できません。接続設定を確認してください。',
    RATE_LIMIT: '生成サービスが混み合っているか、利用上限に達しています。少し時間をおいてお試しください。',
    LIMIT: '作成回数の上限に達しました。保存済みの内容はそのまま残っています。',
    STORAGE: '保存できず作成を止めました。保存先の空き容量や設定を確認してください。',
    STYLE_REFERENCE: '参考漫画を読み込めず作成を止めました。サーバーに参考画像を配置して、もう一度お試しください。',
    INCOMPLETE: '紹介内容を最後まで作れませんでした。もう一度お試しください。',
    TIMEOUT: '作成が時間切れになりました。保存状態を確認して、もう一度お試しください。',
  };
  return messages[code] ?? (hasScript ? `画像の作成が途中で止まりました。${completed ? `保存済みの${completed}コマ` : '保存済みの紹介内容'}から再開できます。` : '紹介内容の作成が途中で止まりました。もう一度お試しください。');
}
function prefix(text, length) {
  let end = Math.min(text.length, length);
  if (!validOffset(text, end)) end--;
  const stop = text.lastIndexOf('。', end - 1);
  if (end < text.length && stop > end * 0.6) end = stop + 1;
  return text.slice(0, end);
}
export function introSource(text, title) {
  let opening = prefix(text, Math.max(1, Math.min(6000, Math.ceil(text.length * 0.35))));
  if (title.includes('走れメロス')) {
    const phrase = 'メロスは、すぐに出発した。', found = text.indexOf(phrase);
    if (found >= 0 && found + phrase.length <= 12000) opening = text.slice(0, found + phrase.length);
  }
  const context = prefix(text, Math.max(opening.length, Math.min(20000, Math.ceil(text.length * 0.6))));
  return { opening, context: context.startsWith(opening) ? context : opening };
}
export function validateScript(value, opening) {
  if (value?.format !== undefined && value.format !== 'manga-v2') throw new Error('INVALID_RESULT');
  if (typeof value?.cast !== 'string' || !value.cast.trim() || value.cast.length > 1600 || !Array.isArray(value.panels) || value.panels.length !== 4) throw new Error('INVALID_RESULT');
  const panels = value.panels.map(panel => {
    for (const [field, limit] of [['title', 60], ['caption', 260], ['scene', 1200], ['quote', 240]]) if (typeof panel?.[field] !== 'string' || !panel[field].trim() || panel[field].length > limit) throw new Error('INVALID_RESULT');
    let start = opening.indexOf(panel.quote); if (start < 0) throw new Error('UNGROUNDED');
    if (panel.start !== undefined || panel.end !== undefined) {
      if (!validOffset(opening, panel.start) || !validOffset(opening, panel.end) || panel.end - panel.start !== panel.quote.length || opening.slice(panel.start, panel.end) !== panel.quote) throw new Error('UNGROUNDED');
      start = panel.start;
    }
    const balloons = value.format === 'manga-v2' ? validateBalloons(panel.balloons, opening) : undefined;
    return { title: panel.title, caption: panel.caption, scene: panel.scene, quote: panel.quote, start, end: start + panel.quote.length, ...(balloons ? { balloons } : {}) };
  });
  return { cast: value.cast, panels, ...(value.format ? { format: value.format } : {}) };
}
function validateBalloons(value, opening) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 3) throw new Error('INVALID_RESULT');
  const occupied = new Set();
  return value.map(item => {
    const narration = item?.kind === 'narration';
    if (!['speech', 'thought', 'narration'].includes(item?.kind) || !['left', 'right', 'bottom'].includes(item.slot)
      || narration !== (item.slot === 'bottom') || occupied.has(item.slot)
      || typeof item.speaker !== 'string' || item.speaker.length > 40 || (!narration && !item.speaker.trim())
      || typeof item.text !== 'string' || !item.text.trim() || item.text.length > (narration ? 48 : 32) || /[\r\n\u0000-\u001f]/.test(item.text)
      || typeof item.quote !== 'string' || !item.quote.trim() || item.quote.length > 240) throw new Error('INVALID_RESULT');
    const start = opening.indexOf(item.quote);
    if (start < 0 || (!narration && !item.quote.includes(item.text))) throw new Error('UNGROUNDED');
    if ((item.start !== undefined || item.end !== undefined) && (!validOffset(opening, item.start) || !validOffset(opening, item.end) || opening.slice(item.start, item.end) !== item.quote)) throw new Error('UNGROUNDED');
    occupied.add(item.slot);
    return { kind: item.kind, slot: item.slot, speaker: narration ? '' : item.speaker, text: item.text, quote: item.quote, start: item.start ?? start, end: item.end ?? start + item.quote.length };
  });
}
