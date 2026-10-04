import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTranscript, verifyTranscriptExcerpt, youtubeVideoId } from './transcript.mjs';

test('parses pasted timestamps and caption cues', () => {
  assert.deepEqual(parseTranscript('[00:12] First claim\n[1:03] Second claim').map(x => x.seconds), [12, 63]);
  assert.deepEqual(parseTranscript('WEBVTT\n\n00:00:05.000 --> 00:00:08.000\nA sentence\n\n00:00:09.000 --> 00:00:10.000\nAnother').map(x => x.text), ['A sentence', 'Another']);
});

test('accepts only YouTube video URLs', () => {
  assert.equal(youtubeVideoId('https://youtu.be/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(youtubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(youtubeVideoId('https://example.com/watch?v=dQw4w9WgXcQ'), null);
});

test('accepts a transcript excerpt only when the words occur in a segment', () => {
  const segments = parseTranscript('[00:12] Angels are addressed in the psalm.\n[01:03] That does not establish a petition.');
  assert.equal(verifyTranscriptExcerpt(segments, 'Angels are addressed in the psalm')?.seconds, 12);
  assert.equal(verifyTranscriptExcerpt(segments, 'Nobody has ever prayed to angels'), null);
});
