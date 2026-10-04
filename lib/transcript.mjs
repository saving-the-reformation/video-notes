export function parseTimestamp(value) {
  const parts = value.trim().replace(',', '.').split(':').map(Number);
  if (parts.length < 2 || parts.length > 3 || parts.some(Number.isNaN)) return null;
  const seconds = parts.reduce((total, part) => total * 60 + part, 0);
  return Number.isFinite(seconds) && seconds >= 0 ? Math.floor(seconds) : null;
}

export function formatTimestamp(seconds) {
  const safe = Math.max(0, Math.floor(Number(seconds) || 0));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

export function parseTranscript(input) {
  const normalized = String(input || '').replace(/\r\n?/g, '\n').trim();
  if (!normalized) return [];
  const lines = normalized.split('\n');
  const segments = [];
  let currentTime = null;
  let buffer = [];
  const flush = () => {
    const text = buffer.join(' ').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    if (text) segments.push({ seconds: currentTime, time: currentTime === null ? '' : formatTimestamp(currentTime), text });
    buffer = [];
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || /^WEBVTT(?:\s.*)?$/.test(line) || /^\d+$/.test(line)) continue;
    const cue = line.match(/^(\d{1,2}:)?\d{1,2}:\d{2}(?:[.,]\d+)?\s*-->\s*/);
    if (cue) { flush(); currentTime = parseTimestamp(cue[0].split('-->')[0]); continue; }
    const inline = line.match(/^\[?((?:\d{1,2}:)?\d{1,2}:\d{2}(?:[.,]\d+)?)\]?\s*(?:[-–—:]\s*)?(.*)$/);
    if (inline) { flush(); currentTime = parseTimestamp(inline[1]); if (inline[2]) buffer.push(inline[2]); continue; }
    buffer.push(line);
  }
  flush();
  return segments;
}

export function verifyTranscriptExcerpt(segments, excerpt) {
  const normalize = value => String(value || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
  const needle = normalize(excerpt);
  if (!needle || needle.length < 8) return null;
  return segments.find(segment => normalize(segment.text).includes(needle)) || null;
}

export function youtubeVideoId(raw) {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    let id = null;
    if (host === 'youtu.be' || host === 'www.youtu.be') id = url.pathname.slice(1).split('/')[0];
    else if (['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(host)) {
      id = url.pathname === '/watch' ? url.searchParams.get('v') : url.pathname.match(/^\/(?:shorts|live|embed)\/([^/]+)/)?.[1];
    }
    return /^[A-Za-z0-9_-]{11}$/.test(id || '') ? id : null;
  } catch { return null; }
}
