export function bindGuideKeyboard(target, getToggle) {
  const keydown = event => {
    if (event.defaultPrevented || event.repeat || event.isComposing || event.altKey || event.ctrlKey || event.metaKey || (event.code !== 'Space' && event.key !== ' ')) return;
    if (event.target?.closest?.('input, textarea, select, button, a, [role="button"], [role="slider"], [role="textbox"], [contenteditable]:not([contenteditable="false"])')) return;
    const toggle = getToggle(); if (!toggle) return;
    event.preventDefault(); toggle();
  };
  target.addEventListener('keydown', keydown);
  return () => target.removeEventListener('keydown', keydown);
}
