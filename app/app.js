const extension = Boolean(globalThis.chrome?.runtime?.id);
const apiBase = extension ? 'http://127.0.0.1:4317' : '';
const $ = id => document.getElementById(id);
const sampleUrl = 'https://www.youtube.com/watch?v=qSuCPooR3E4&t=288s';
let currentResult = null;
if (!extension) { $('importMain').hidden = true; $('importComparison').hidden = true; }

function previewVideo() {
  let id = null, start = 0;
  try {
    const url = new URL($('videoUrl').value);
    if (['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(url.hostname) && url.pathname === '/watch') id = url.searchParams.get('v');
    if (url.hostname === 'youtu.be') id = url.pathname.slice(1);
    const at = url.searchParams.get('t') || '';
    start = /^\d+s?$/.test(at) ? Number.parseInt(at, 10) : 0;
  } catch { /* No preview until a valid URL is entered. */ }
  if (!/^[a-zA-Z0-9_-]{11}$/.test(id || '')) id = null;
  $('videoPreview').hidden = !id;
  const src = id ? `https://www.youtube-nocookie.com/embed/${id}${start ? `?start=${start}` : ''}` : '';
  if ($('videoFrame').getAttribute('src') !== src) $('videoFrame').setAttribute('src', src);
}
$('videoUrl').addEventListener('change', previewVideo);

function setStatus(message, error = false) { $('serverStatus').textContent = message; $('serverStatus').classList.toggle('error', error); }
async function checkServer() {
  if (location.protocol === 'file:') { setStatus('Start the server, then open http://127.0.0.1:4317 in your browser.', true); return; }
  try {
    const response = await fetch(`${apiBase}/api/status`);
    if (!response.ok) throw new Error();
    const data = await response.json();
    setStatus(!data.ready ? 'Open Settings to connect OpenAI.' : data.geminiReady ? 'Ready for a video.' : 'OpenAI connected. Add a transcript, or connect Gemini for link-only notes.');
  } catch { setStatus('Start the local server with npm start.', true); }
}
const settingsDialog = $('settingsDialog');
$('settingsButton').addEventListener('click', () => settingsDialog.showModal());
$('closeSettings').addEventListener('click', () => settingsDialog.close());
settingsDialog.addEventListener('click', event => { if (event.target === settingsDialog) settingsDialog.close(); });
async function saveKey(provider) {
  if (location.protocol === 'file:') { setStatus('Open the website at http://127.0.0.1:4317 to save a key.', true); return; }
  const input = $(provider === 'openai' ? 'openaiKey' : 'geminiKey');
  const status = $(provider === 'openai' ? 'openaiKeyStatus' : 'geminiKeyStatus');
  const button = $(provider === 'openai' ? 'saveOpenai' : 'saveGemini');
  if (!input.value.trim()) { status.textContent = 'Paste a key first.'; status.classList.add('error'); return; }
  button.disabled = true; status.textContent = 'Saving…'; status.classList.remove('error');
  try {
    const response = await fetch(`${apiBase}/api/settings`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ provider, key: input.value.trim() }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not save the key.');
    input.value = ''; status.textContent = 'Saved on this computer.'; await checkServer();
  } catch (error) { status.textContent = error.message || 'Could not save the key.'; status.classList.add('error'); }
  finally { button.disabled = false; }
}
$('saveOpenai').addEventListener('click', () => saveKey('openai'));
$('saveGemini').addEventListener('click', () => saveKey('gemini'));
function timeLabel(seconds) {
  const n = Math.max(0, Number(seconds) || 0), h = Math.floor(n / 3600), m = Math.floor((n % 3600) / 60), s = Math.floor(n % 60);
  return h ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}` : `${m}:${String(s).padStart(2,'0')}`;
}
function timestampSeconds(value) {
  const parts = String(value || '').split(':').map(Number);
  return parts.every(Number.isFinite) ? parts.reduce((total, part) => total * 60 + part, 0) : 0;
}
function fillCapture(data, slot) {
  const comparison = slot === 'comparison';
  $(comparison ? 'comparisonVideoUrl' : 'videoUrl').value = data.videoUrl;
  if (!comparison) previewVideo();
  $(comparison ? 'comparisonTranscript' : 'transcript').value = data.transcript;
  const coverage = data.duration && timestampSeconds(data.lastTime) < data.duration * .85;
  setStatus(`Imported ${data.count} timestamped lines through ${data.lastTime}.${coverage ? ' Check that the transcript loaded to the end.' : ''}`, coverage);
}
async function importFromYouTube(slot) {
  try {
    const [active] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!active?.id) throw new Error('Open a YouTube video in the active tab.');
    const data = await chrome.tabs.sendMessage(active.id, { type: 'VIDEO_ARGUMENT_LAB_READ_TRANSCRIPT' });
    if (data?.error) throw new Error(data.error);
    if (!data?.transcript) throw new Error('Open Show transcript on YouTube, then try again.');
    fillCapture(data, slot);
    try { await fetch(`${apiBase}/api/capture`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...data, slot }) }); } catch { /* Side panel still has text. */ }
  } catch (error) { setStatus(error.message || 'Could not import the transcript.', true); }
}
async function loadCaptured(slot) {
  try {
    const response = await fetch(`${apiBase}/api/capture?slot=${slot}`), data = await response.json();
    if (!response.ok) throw new Error(data.error || 'No recent import.');
    fillCapture(data, slot);
  } catch (error) { setStatus(error.message || 'Could not load the import.', true); }
}
$('importMain').addEventListener('click', () => importFromYouTube('main'));
$('importComparison').addEventListener('click', () => importFromYouTube('comparison'));
$('loadMain').addEventListener('click', () => loadCaptured('main'));
$('loadComparison').addEventListener('click', () => loadCaptured('comparison'));
$('sampleButton').addEventListener('click', () => { $('videoUrl').value = sampleUrl; previewVideo(); setStatus('Example video added. Select Make notes when you’re ready.'); });

function node(tag, className, content) { const el = document.createElement(tag); if (className) el.className = className; if (content !== undefined) el.textContent = content; return el; }
function timeLink(videoId, seconds) {
  const el = node(videoId ? 'a' : 'span', 'time', timeLabel(seconds));
  if (videoId) { el.href = `https://www.youtube.com/watch?v=${videoId}&t=${seconds}s`; el.target = '_blank'; el.rel = 'noopener noreferrer'; }
  return el;
}
function addSources(parent, sources) {
  const box = node('div', 'sources');
  if (!sources?.length) box.append(node('span', 'no-source', 'No verified link available'));
  for (const source of sources || []) {
    const link = node('a', 'source', source.title || 'Open source');
    link.href = source.url; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.title = source.relevance;
    box.append(link);
  }
  parent.append(box);
}
function render(result) {
  currentResult = result;
  $('emptyState').hidden = true; $('result').hidden = false;
  const provisional = result.transcriptMode === 'gemini-video-notes';
  $('resultMeta').textContent = `${result.claims.length} moments · ${result.source_audit.length} sources`;
  $('provenance').textContent = provisional ? 'Made from Gemini video notes. Points are paraphrased and timestamps are approximate; check the video before quoting.' : 'Made from a timestamped transcript. Short quotes are matched to the supplied text.';
  $('summary').textContent = result.summary; $('mainIdea').textContent = result.main_idea;
  $('takeaways').replaceChildren(...result.takeaways.map(value => node('li', '', value)));
  const moments = $('claims'); moments.replaceChildren();
  for (const item of result.claims) {
    const card = node('article', 'moment'), head = node('div', 'moment-head');
    head.append(timeLink(result.videoId, item.seconds), node('h4', '', item.point)); card.append(head, node('p', '', item.explanation));
    if (item.excerpt_verified) card.append(node('p', 'excerpt', `“${item.transcript_excerpt}”`));
    addSources(card, item.sources); moments.append(card);
  }
  const audit = $('sourceAudit'); audit.replaceChildren();
  if (!result.source_audit.length) audit.append(node('p', 'no-source', 'No named sources found in this video.'));
  for (const item of result.source_audit) {
    const card = node('article', 'audit'), head = node('div', 'audit-head');
    head.append(timeLink(result.videoId, item.seconds), node('h4', '', item.source_name)); card.append(head);
    card.append(node('p', 'meta', `${item.verification} · ${item.confidence}`));
    if (item.excerpt_verified) card.append(node('p', 'excerpt', `“${item.speaker_excerpt}”`));
    card.append(node('p', '', item.speaker_use), node('p', '', item.finding)); addSources(card, item.sources); audit.append(card);
  }
  $('comparisonSection').hidden = !result.comparison_checks.length;
  const comparison = $('comparisonChecks'); comparison.replaceChildren();
  for (const item of result.comparison_checks) {
    const card = node('article', 'audit'), head = node('div', 'audit-head');
    head.append(timeLink(result.videoId, item.main_seconds), node('h4', '', item.claim_about_other)); card.append(head, node('p', '', item.finding));
    if (item.excerpt_verified) { const p = node('p', 'excerpt'); p.append(timeLink(result.comparisonVideoId, item.comparison_seconds), document.createTextNode(` “${item.comparison_excerpt}”`)); card.append(p); }
    comparison.append(card);
  }
  $('limits').textContent = result.research_limits;
}
function markdown(result) {
  const url = `https://www.youtube.com/watch?v=${result.videoId}`;
  const lines = [`# Video Notes — ${url}`, '', result.transcriptMode === 'gemini-video-notes' ? '_Gemini video notes: paraphrases with approximate timestamps._' : '_Based on a timestamped transcript._', '', '## At a glance', result.summary, '', `**Main idea:** ${result.main_idea}`, '', '## What to remember', ...result.takeaways.map(x => `- ${x}`), '', '## Key moments'];
  for (const item of result.claims) {
    lines.push('', `### [${timeLabel(item.seconds)}](${url}&t=${item.seconds}s) ${item.point}`, item.explanation);
    if (item.excerpt_verified) lines.push(`> “${item.transcript_excerpt}”`);
    for (const source of item.sources) lines.push(`- [${source.title}](${source.url}) — ${source.relevance}`);
  }
  lines.push('', '## Sources mentioned');
  for (const item of result.source_audit) {
    lines.push('', `### [${timeLabel(item.seconds)}](${url}&t=${item.seconds}s) ${item.source_name}`, `${item.speaker_use} ${item.finding}`, `Verification: ${item.verification}`);
    for (const source of item.sources) lines.push(`- [${source.title}](${source.url}) — ${source.relevance}`);
  }
  if (result.comparison_checks.length) lines.push('', '## Second video check', ...result.comparison_checks.map(x => `- [${timeLabel(x.main_seconds)}](${url}&t=${x.main_seconds}s) ${x.claim_about_other}: ${x.finding}`));
  lines.push('', '## What still needs checking', result.research_limits);
  return lines.join('\n');
}
async function readTranscriptFile(file) {
  if (file.name.toLowerCase().endsWith('.docx')) {
    if (file.size > 2000000) throw new Error('DOCX file must be under 2 MB.');
    const bytes = new Uint8Array(await file.arrayBuffer()); let binary = '';
    for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    const response = await fetch(`${apiBase}/api/extract-docx`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ content: btoa(binary) }) });
    const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Could not read DOCX.'); return data.text;
  }
  if (file.size > 200000) throw new Error('Text file must be under 200 KB.'); return file.text();
}
async function loadFile(event, targetId) {
  const file = event.target.files?.[0]; if (!file) return;
  try { $(targetId).value = await readTranscriptFile(file); setStatus(`Loaded ${file.name}.`); }
  catch (error) { setStatus(error.message || 'Could not read file.', true); }
}
$('fileInput').addEventListener('change', event => loadFile(event, 'transcript'));
$('comparisonFileInput').addEventListener('change', event => loadFile(event, 'comparisonTranscript'));
$('analysisForm').addEventListener('submit', async event => {
  event.preventDefault();
  if (location.protocol === 'file:') { setStatus('Open http://127.0.0.1:4317 after starting the server to make notes.', true); return; }
  const button = $('analyzeButton'); button.disabled = true; button.firstChild.textContent = 'Exploring video… ';
  setStatus('Watching the video and checking sources. This may take a few minutes.');
  try {
    const response = await fetch(`${apiBase}/api/analyze`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ videoUrl: $('videoUrl').value, transcript: $('transcript').value, comparisonVideoUrl: $('comparisonVideoUrl').value, comparisonTranscript: $('comparisonTranscript').value, priority: $('priority').value }) });
    const data = await response.json(); if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
    render(data); setStatus('Notes are ready. Open any timestamp or source to check it.');
  } catch (error) { setStatus(error.message || 'Could not make notes.', true); }
  finally { button.disabled = false; button.firstChild.textContent = 'Make notes '; }
});
$('exportButton').addEventListener('click', async () => {
  if (!currentResult) return;
  try { await navigator.clipboard.writeText(markdown(currentResult)); setStatus('Notes copied.'); }
  catch { setStatus('Could not copy. Check clipboard permission.', true); }
});
if (extension && globalThis.chrome?.tabs?.query) chrome.tabs.query({ active: true, lastFocusedWindow: true }, tabs => { const url = tabs?.[0]?.url; if (url?.includes('youtube.com/watch') || url?.includes('youtu.be/')) { $('videoUrl').value = url; previewVideo(); } });
checkServer();
