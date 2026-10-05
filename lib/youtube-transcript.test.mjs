import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const script = readFileSync(new URL('../app/youtube-transcript.js', import.meta.url), 'utf8');

function capture(rows, autoOpen = false, openOnDemand = false) {
  let listener;
  let expanded = false;
  let currentRows = openOnDemand ? [] : rows;
  const showButton = { getClientRects: () => expanded ? [1] : [], getAttribute: () => 'Show transcript', textContent: 'Show transcript', click: () => { currentRows = rows; } };
  const expandButton = { getClientRects: () => [1], click: () => { expanded = true; } };
  const document = {
    title: 'Example video - YouTube',
    querySelectorAll: selector => selector.includes('transcript-segment-view-model') ? currentRows : selector.includes('description-transcript-section-renderer button') || selector === 'button' ? [showButton] : selector.includes('#expand') ? [expandButton] : [],
    querySelector: selector => selector === 'video' ? { duration: 121 } : null
  };
  const chrome = { runtime: { onMessage: { addListener(fn) { listener = fn; } } } };
  vm.runInNewContext(script, { document, chrome, location: { href: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }, getComputedStyle: () => ({ visibility: 'visible' }), URL, Map, setTimeout });
  return new Promise(resolve => listener({ type: 'VIDEO_ARGUMENT_LAB_READ_TRANSCRIPT', autoOpen }, {}, resolve));
}

function row(time, text) {
  return {
    getClientRects: () => [1],
    querySelector: selector => selector.includes('timestamp') ? { textContent: time } : { textContent: text }
  };
}

test('imports visible timestamped transcript rows without inventing text', async () => {
  const result = await capture([row('0:12', 'First point'), row('1:03', 'Second point')]);
  assert.equal(result.transcript, '[0:12] First point\n[1:03] Second point');
  assert.equal(result.count, 2);
  assert.equal(result.lastTime, '1:03');
});

test('does not claim a transcript when the panel is closed', async () => {
  assert.match((await capture([])).error, /Show transcript/);
});

test('automatic import reuses an already open transcript', async () => {
  const result = await capture([row('0:12', 'First point'), row('0:30', 'Second point')], true);
  assert.equal(result.count, 2);
});

test('automatic import opens a collapsed YouTube transcript panel', async () => {
  const result = await capture([row('0:12', 'First point'), row('0:30', 'Second point')], true, true);
  assert.equal(result.count, 2);
});
