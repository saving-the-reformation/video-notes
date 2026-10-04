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
});
