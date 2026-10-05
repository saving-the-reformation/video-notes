import test from 'node:test';
import assert from 'node:assert/strict';

process.env.VIDEO_NOTES_TEST = '1';
process.env.OPENAI_API_KEY = 'test-key';
process.env.GEMINI_API_KEY = 'test-key';
const { analyze } = await import('../server.mjs');

const fakeResult = excerpt => ({
  summary: 'A short account of the video.', main_idea: 'The video explains a topic.', takeaways: ['First point'], research_limits: 'Check the original video.',
  claims: [{ seconds: 10, point: 'First point', explanation: 'The speaker explains it.', transcript_excerpt: excerpt, sources: [] }],
  source_audit: [], comparison_checks: []
});
const openAIMessage = text => ({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text }] }] });

test('link-only Gemini notes never become verified quotations', async () => {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), body: JSON.parse(options.body) });
    if (String(url).includes('googleapis.com')) return Response.json({ steps: [{ type: 'model_output', content: [{ type: 'text', text: '[00:10] A first paraphrased point about the topic.\n[00:30] A second paraphrased point about the topic.' }] }] });
    if (calls.filter(x => x.url.includes('api.openai.com')).length === 1) return Response.json(openAIMessage('Research notes.'));
    return Response.json(openAIMessage(JSON.stringify(fakeResult('A first paraphrased point'))));
  };
  const result = await analyze({ videoUrl: 'https://www.youtube.com/watch?v=qSuCPooR3E4', transcript: '' });
  assert.equal(result.transcriptMode, 'gemini-video-notes');
  assert.equal(result.claims[0].excerpt_verified, false);
  assert.equal(result.claims[0].transcript_excerpt, '');
  assert.match(calls[0].body.input[0].uri, /qSuCPooR3E4/);
  assert.equal(calls[0].body.input[0].processing, 'agentic');
  assert.equal(calls[0].body.store, false);
});

test('supplied transcript is used without sending video to Gemini', async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return Response.json(openAIMessage(calls === 1 ? 'Research notes.' : JSON.stringify(fakeResult('A first exact point'))));
  };
  const result = await analyze({ videoUrl: 'https://www.youtube.com/watch?v=qSuCPooR3E4', transcript: '[00:10] A first exact point about the topic.\n[00:30] A second exact point about the topic.' });
  assert.equal(calls, 2);
  assert.equal(result.transcriptMode, 'youtube-transcript');
  assert.equal(result.claims[0].excerpt_verified, true);
  assert.equal(result.claims[0].caption_near.seconds, 10);
  assert.match(result.claims[0].caption_near.text, /first exact point/i);
});

test('Gemini capacity errors become a transcript fallback with one retry', async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return Response.json({ error: { message: 'high demand' } }, { status: 503 });
  };
  await assert.rejects(
    analyze({ videoUrl: 'https://www.youtube.com/watch?v=qSuCPooR3E4', transcript: '' }),
    error => error.code === 'TRANSCRIPT_NEEDED' && /transcript/i.test(error.message)
  );
  assert.equal(calls, 2);
});

test('a rejected Gemini key is reported without retrying', async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; return Response.json({ error: { message: 'API key invalid' } }, { status: 401 }); };
  await assert.rejects(analyze({ videoUrl: 'https://www.youtube.com/watch?v=qSuCPooR3E4', transcript: '' }), error => error.code === 'GEMINI_KEY_INVALID' && /Settings/.test(error.message));
  assert.equal(calls, 1);
});

test('an outside reference is not presented as a verified speaker mention', async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    if (calls === 1) return Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: 'Research memo.', annotations: [{ type: 'url_citation', url: 'https://example.com/source' }] }] }] });
    const result = fakeResult('A first exact point');
    result.source_audit = [{ seconds: 10, source_name: 'Outside reference', speaker_excerpt: 'Words the speaker never said', speaker_use: 'The speaker cited this source.', finding: 'A tentative finding.', verification: 'Direct source checked', confidence: 'Sure', sources: [{ title: 'Source', url: 'https://example.com/source', relevance: 'Related reading' }] }];
    return Response.json(openAIMessage(JSON.stringify(result)));
  };
  const result = await analyze({ videoUrl: 'https://www.youtube.com/watch?v=qSuCPooR3E4', transcript: '[00:10] A first exact point about the topic.\n[00:30] A second exact point about the topic.' });
  const source = result.source_audit[0];
  assert.equal(source.excerpt_verified, false);
  assert.equal(source.speaker_excerpt, '');
  assert.match(source.speaker_use, /not confirmed/i);
  assert.equal(source.confidence, 'Not sure');
  assert.equal(source.verification, 'Indirect source only');
});
