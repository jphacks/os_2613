export function horizontalTurn(dx: number, dy: number): 'next' | 'prev' | null;
export function edgeTurn(x: number, left: number, width: number): 'next' | 'prev' | null;
export function pageForAnchor(offsets: number[], pageOf: number[], anchor: number): number;
