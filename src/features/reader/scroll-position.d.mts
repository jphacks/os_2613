export function visibleScrollPage(scrollLeft: number, width: number, count: number): number;
export function guideScrollLeft(scrollLeft: number, viewportRight: number, characterRight: number, width: number, scrollWidth: number, columnWidth?: number): number;
export function smoothGuideScroll(current: number, target: number, elapsed: number): number;

export function guideOpacity(index: number, cursor: number, activePage?: boolean): number;

export function guideFramePosition(from: number, to: number, elapsed: number, duration: number): number;

export function guideRowWave(rows: { distance: number; indices: number[] }[], distance: number, spacing: number): { index: number; first: number; last: number } | null;
