// Reads YouTube's transcript panel. It does not call private caption endpoints.
(() => {
  function visible(element) {
    return Boolean(element?.getClientRects().length && getComputedStyle(element).visibility !== 'hidden');
  }

  const rowSelector = 'ytd-transcript-segment-renderer, transcript-segment-view-model';

  function extract() {
    const videoId = new URL(location.href).searchParams.get('v');
    if (!/^[A-Za-z0-9_-]{11}$/.test(videoId || '')) return { error: 'Open a YouTube watch page first.' };
    const rows = [...document.querySelectorAll(rowSelector)].filter(visible);
    if (!rows.length) return { error: 'Open YouTube’s “Show transcript” panel, then click Import again. If you just installed the extension, refresh the video page.' };
    const segments = [];
    for (const row of rows) {
      const time = row.querySelector('.segment-timestamp, [class*="segment-timestamp"], [class*="TranscriptSegmentViewModelTimestamp"]:not([class*="A11y"])')?.textContent?.trim();
      const text = row.querySelector('.segment-text, [class*="segment-text"], [role="text"]')?.textContent?.replace(/\s+/g, ' ').trim();
      if (/^(?:\d{1,2}:)?\d{1,2}:\d{2}$/.test(time || '') && text) segments.push({ time, text });
    }
    if (!segments.length) return { error: 'The visible transcript did not contain readable timestamps and text. Try closing and reopening “Show transcript”.' };
    const unique = [...new Map(segments.map(item => [`${item.time}|${item.text}`, item])).values()];
    const transcript = unique.map(item => `[${item.time}] ${item.text}`).join('\n');
    const video = document.querySelector('video');
    const duration = Number.isFinite(video?.duration) ? Math.floor(video.duration) : null;
    return { videoUrl: `https://www.youtube.com/watch?v=${videoId}`, title: document.title.replace(/\s*-\s*YouTube$/, ''), transcript, count: unique.length, duration, lastTime: unique.at(-1).time };
  }

  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  function transcriptButton() {
    const inSection = [...document.querySelectorAll('ytd-video-description-transcript-section-renderer button')].find(visible);
    if (inSection) return inSection;
    return [...document.querySelectorAll('button')].find(button =>
      visible(button) && /show transcript/i.test(`${button.getAttribute('aria-label') || ''} ${button.textContent || ''}`));
  }
  async function openTranscript() {
    if ([...document.querySelectorAll(rowSelector)].some(visible)) return;
    let button = transcriptButton();
    if (!button) {
      const expand = [...document.querySelectorAll('ytd-watch-metadata #description-inline-expander #expand, ytd-watch-metadata #description #expand')].find(visible);
      if (expand) { expand.click(); await pause(300); }
      button = transcriptButton();
    }
    if (button) button.click();
    for (let i = 0; i < 32; i++) {
      if ([...document.querySelectorAll(rowSelector)].some(visible)) return;
      await pause(250);
    }
  }

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request?.type !== 'VIDEO_ARGUMENT_LAB_READ_TRANSCRIPT') return;
    (async () => {
      if (request.autoOpen) await openTranscript();
      sendResponse(extract());
    })().catch(error => sendResponse({ error: `Could not read the YouTube transcript: ${error.message}` }));
    return true;
  });
})();
