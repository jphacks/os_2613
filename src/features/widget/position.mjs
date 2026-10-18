import { validOffset } from '../bookmark/model.mjs';

// ウィジェットのmarkは「最後に読んだ位置」。手動しおりの文字末尾とは異なり、1文字戻さない。
export function widgetPosition(text, mark) {
  if (typeof mark !== 'string' || !/^\d+$/.test(mark)) return undefined;
  const offset = Number(mark);
  return validOffset(text, offset) ? offset : undefined;
}
