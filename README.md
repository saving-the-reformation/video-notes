# Video Notes

A local website and Chrome side panel for understanding public YouTube videos. It makes a plain-language overview, chronological key moments, takeaways, and a separate source check. A second video transcript can be added for comparison.

## Setup

1. Use Node.js 20 or later.
2. Run `npm start` here and open <http://127.0.0.1:4317>.
3. Select **Settings** to save an OpenAI API key on this computer. Add a Gemini API key there if you want link-only video review. The app stores keys in a private `.env` file; it never displays saved keys again.
4. To use the Chrome side panel, open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select the `app` folder. Refresh YouTube tabs that were already open.

Paste a public YouTube URL and choose **Make notes**. In the Chrome side panel, Video Notes first tries to open and read the visible YouTube transcript for that same video. This gives the most dependable wording and timestamps without copying anything into a document. If YouTube has no readable transcript, Gemini examines the video and creates timestamped *paraphrase notes*. OpenAI organizes the text and checks relevant sources on the web. Gemini's direct YouTube URL support is in preview and may have changing limits or pricing.

If automatic import does not work, open **Show transcript** on the YouTube watch page, then choose **Import from YouTube** in the extension. The website can choose **Use latest import** after an extension import. Pasting or uploading timestamped DOCX, SRT, VTT, or TXT is also supported. The extension reads only YouTube's visible transcript panel; it does not use private caption endpoints or download video media. Imported transcripts are kept in server memory, not written to disk. A Gemini failure triggers a clear transcript fallback rather than showing a raw provider error.

The example button fills in the supplied test link: <https://www.youtube.com/watch?v=qSuCPooR3E4&t=288s>. It starts at the user's 4:48 mark in YouTube; the note making covers the whole video. The example is a link, not a prewritten or verified analysis.

## Accuracy boundaries

- Transcript excerpts are matched across adjacent caption rows. Unmatched excerpts are withheld, and the actual captions near that timestamp are displayed for review.
- Gemini-only notes are paraphrases. The app displays no purported direct quotations from them.
- Source links must appear in the OpenAI web research response. The app labels whether the related caption text was matched to the transcript. This does not prove that the speaker named the linked page; outside references remain separate from literal video quotations. A source check may still be indirect or unverified.
- Named source interpretations, timestamps, and factual claims still need review before reuse.
- Optional comparison checks use the supplied second transcript.

The local server listens on `127.0.0.1:4317`. Video links go to Gemini when using link-only review; transcript or Gemini notes go to OpenAI. API usage may incur charges. The default OpenAI API model is `gpt-5.6-sol` with medium reasoning; the default Gemini model is `gemini-3.5-flash-lite` with agentic video processing. Run `npm test` for parser and importer checks.

## Sharing and hosting

The [GitHub repository](https://github.com/saving-the-reformation/video-notes) shares the code. It is not itself a live website. Each local user needs Node.js and their own API keys. Never commit `.env` or put API keys in a static site or extension package. A public hosted version needs accounts, usage limits, and server-side key protection before accepting arbitrary visitors; otherwise visitors could spend the owner's API balance. DigitalOcean App Platform can host a later server version once those controls are in place.
