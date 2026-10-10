# Publish Video Notes on DigitalOcean

This repository contains a Node server, so GitHub Pages cannot run the live research tool. A DigitalOcean App Platform **web service** can run it and assign an HTTPS `ondigitalocean.app` link.

1. Push this repository to GitHub and sign in to DigitalOcean.
2. In App Platform, create an app from `saving-the-reformation/video-notes` on the `main` branch. Select the repository root as the source directory and a **web service** component. Use Node.js 20 or newer.
3. Set the run command to `npm start` and the HTTP port to `8080`. Add the environment variable `HOSTED=1` for runtime. Do not add your personal OpenAI or Gemini keys to the app.
4. Choose the smallest suitable paid web service plan. Review its recurring cost and deploy. The app should create a public HTTPS `*.ondigitalocean.app` URL.
5. Open the URL and confirm the page asks visitors for their own API keys in Settings. Test with a key you control, check `/api/status` returns `"hosted":true`, and make sure `/api/settings` does not save keys.

The service reads `PORT` from App Platform and binds to `0.0.0.0` in hosted mode. The `.env` file is ignored by Git. The Chrome side panel is a local-only workflow for now; the hosted website accepts pasted or uploaded timestamped transcripts and can use Gemini for link-only video notes. A user needs an OpenAI key for every live analysis and a Gemini key if no transcript is supplied.

For a publicly funded version where visitors do not supply keys, add user accounts, persistent quotas, abuse protection, and provider spending controls before placing an owner key on the server.
