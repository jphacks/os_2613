// ウィジェットのしおりリンクだけ、元の画面を見せる遷移アニメーションを省く。
export function widgetEntryOptions(params) {
  const mark = params?.mark;
  if (typeof mark !== 'string' || !/^\d+$/.test(mark) || !Number.isSafeInteger(Number(mark))) return {};
  return { animation: 'none' };
}
