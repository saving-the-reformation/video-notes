import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const script = readFileSync(new URL('../app/youtube-transcript.js', import.meta.url), 'utf8');

function capture(rows) {
  let listener;
  const document = {
    title: 'Example video - YouTube',
    querySelectorAll: () => rows,
    querySelector: () => ({ duration: 121 })
  };
  const chrome = { runtime: { onMessage: { addListener(fn) { listener = fn; } } } };
  vm.runInNewContext(script, { document, chrome, location: { href: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }, getComputedStyle: () => ({ visibility: 'visible' }), URL, Map });
  let result;
  listener({ type: 'VIDEO_ARGUMENT_LAB_READ_TRANSCRIPT' }, {}, value => { result = value; });
  return result;
}

function row(time, text) {
  return {
    getClientRects: () => [1],
    querySelector: selector => selector.includes('timestamp') ? { textContent: time } : { textContent: text }
  };
}

test('imports visible timestamped transcript rows without inventing text', () => {
  const result = capture([row('0:12', 'First point'), row('1:03', 'Second point')]);
  assert.equal(result.transcript, '[0:12] First point\n[1:03] Second point');
  assert.equal(result.count, 2);
  assert.equal(result.lastTime, '1:03');
});

test('does not claim a transcript when the panel is closed', () => {
  assert.match(capture([]).error, /Show transcript/);
});
