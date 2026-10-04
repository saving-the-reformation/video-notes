// Reads the transcript that the viewer has opened on the current YouTube page.
// It does not call YouTube's private caption endpoints or inspect hidden player data.
(() => {
  function visible(element) {
    return Boolean(element?.getClientRects().length && getComputedStyle(element).visibility !== 'hidden');
  }

  function extract() {
    const videoId = new URL(location.href).searchParams.get('v');
    if (!/^[A-Za-z0-9_-]{11}$/.test(videoId || '')) return { error: 'Open a YouTube watch page first.' };
    const rows = [...document.querySelectorAll('ytd-transcript-segment-renderer')].filter(visible);
    if (!rows.length) return { error: 'Open YouTube’s “Show transcript” panel, then click Import again. If you just installed the extension, refresh the video page.' };
    const segments = [];
    for (const row of rows) {
      const time = row.querySelector('.segment-timestamp, [class*="segment-timestamp"]')?.textContent?.trim();
      const text = row.querySelector('.segment-text, [class*="segment-text"]')?.textContent?.replace(/\s+/g, ' ').trim();
      if (/^(?:\d{1,2}:)?\d{1,2}:\d{2}$/.test(time || '') && text) segments.push({ time, text });
    }
    if (!segments.length) return { error: 'The visible transcript did not contain readable timestamps and text. Try closing and reopening “Show transcript”.' };
    const unique = [...new Map(segments.map(item => [`${item.time}|${item.text}`, item])).values()];
    const transcript = unique.map(item => `[${item.time}] ${item.text}`).join('\n');
    const video = document.querySelector('video');
    const duration = Number.isFinite(video?.duration) ? Math.floor(video.duration) : null;
    return { videoUrl: `https://www.youtube.com/watch?v=${videoId}`, title: document.title.replace(/\s*-\s*YouTube$/, ''), transcript, count: unique.length, duration, lastTime: unique.at(-1).time };
  }

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request?.type !== 'VIDEO_ARGUMENT_LAB_READ_TRANSCRIPT') return;
    try { sendResponse(extract()); }
    catch (error) { sendResponse({ error: `Could not read the visible transcript: ${error.message}` }); }
  });
})();
