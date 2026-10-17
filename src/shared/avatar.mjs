export function avatarUrl(value) {
  try { const url = new URL(value); return url.protocol === 'https:' && url.hostname === 'cdn.bsky.app' && !url.username && !url.password ? url.href : undefined; } catch { return undefined; }
}
