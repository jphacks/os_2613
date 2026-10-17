// Preserve UTF-16 offsets so existing reading guides and bookmarks remain valid.
export function studySectionNumber(chapterTitle, chapterIndex, partIndex) {
  const sourceNumber = /^\s*(?:第\s*)?([0-9０-９]+)(?:\s*章)?(?=$|[^0-9０-９])/.exec(chapterTitle)?.[1];
  const chapterNumber = sourceNumber
    ? sourceNumber.replace(/[０-９]/g, digit => String.fromCharCode(digit.charCodeAt(0) - 0xFEE0))
    : String(chapterIndex + 1);
  return `${chapterNumber}-${partIndex + 1}`;
}

export function studyLines(text) {
  let offset = 0, section = '', sectionParagraph = 0;
  const raw = text.split('\n'), groups = [];
  for (let i = 0; i < raw.length; i++) {
    let line = raw[i];
    const bracket = /^\s*\\\[/.test(line), dollars = /^\s*\$\$/.test(line);
    if (bracket && !line.includes('\\]') || dollars && (line.match(/\$\$/g) ?? []).length === 1) {
      const close = bracket ? '\\]' : '$$';
      if (raw.slice(i + 1).some(next => next.includes(close))) {
        while (i + 1 < raw.length) { line += '\n' + raw[++i]; if (raw[i].includes(close)) break; }
      }
    }
    groups.push(line);
  }
  return groups.map((line, index) => {
    const start = offset; offset += line.length + 1;
    const sectionTitle = /^\s*#{1,3}\s+(.+?)\s*$/.exec(line)?.[1] ?? null;
    const heading = index === 0 || !!sectionTitle || /^\s*(?:【[^】]+】\s*$|#{1,3}\s)/.test(line);
    if (heading) { section = line; sectionParagraph = 0; }
    const content = !heading && !!line.trim();
    const firstParagraph = content && sectionParagraph === 0;
    if (content) sectionParagraph++;
    const derivation = /途中式|導出|証明|計算手順|計算例|具体例|解答/.test(section);
    const equation = /[=＝^_]|\\(?:frac|sum|int|sqrt)\b/.test(line);
    const continuation = /^\s*(?:[=＝]|\\(?:Rightarrow|therefore)|次に|途中|計算すると)/.test(line);
    const callout = !content || derivation || continuation ? null
      : /^(?:公式|法則|定理)[：:]/.test(line.trim()) || /公式|法則|定理/.test(section) && equation ? 'formula'
        : /^(?:定義)[：:]/.test(line.trim()) || /定義/.test(section) && firstParagraph ? 'definition'
          : /^(?:重要|要点)[：:]/.test(line.trim()) || /要点|ポイント|まとめ|重要/.test(section) && firstParagraph ? 'keypoint' : null;
    const important = /ポイント|要点|まとめ|重要|定義|公式/.test(section);
    const tone = /注意|落とし穴|条件/.test(section) ? 'warning' : /例|具体/.test(section) ? 'example'
      : /公式|定義|ポイント|要点|まとめ|重要/.test(section) ? 'summary' : 'neutral';
    const emphasis = [];
    for (const match of line.matchAll(/「[^」\n]{1,36}」|\*\*[^*\n]{1,80}\*\*/g)) emphasis.push([match.index, match.index + match[0].length]);
    if (important && !heading) {
      const end = line.search(/[。．：:]/);
      emphasis.push([0, Math.min(end < 0 ? line.length : end + 1, 90)]);
    }
    return { text: line, displayText: sectionTitle ?? line, sectionTitle, start, heading, title: index === 0, important, emphasis, tone, callout };
  });
}
