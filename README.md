# FloyoGPT

An open-source ChatGPT-style web app powered by the [Floyo API](https://floyo.ai). Chat with 20+ leading LLMs, drop in an image or video, and get multimodal answers, all from one window.

**Live demo:** https://floyo-llm.vercel.app

## What you get

- Familiar chat interface with conversation history saved in your browser
- 20+ models to choose from (Claude, GPT, Gemini, DeepSeek, Grok, Qwen, and more), plus a Custom field for any model name
- Image and video uploads. The app automatically switches to Alibaba Qwen 3.5 Plus when you attach media
- Markdown answers with code highlighting and a one-click copy button on every code block
- System prompt, temperature, top_p, max tokens, and reasoning toggle, all editable in the UI
- Responsive layout with a collapsible sidebar that works on desktop, tablet, and mobile

## Run it locally

Requires Node.js 18 or newer.

```bash
git clone https://github.com/FloyoAI/floyo-llm.git
cd floyo-llm
npm install
cp .env.example .env
```

Open `.env` and paste your Floyo API key:

```bash
FLOYO_API_KEY=flo_your_real_key_here
```

Then start the app:

```bash
npm run dev
```

Open http://localhost:5174 in your browser. That is it.

## Get a Floyo API key

1. Sign up at https://floyo.ai
2. Open your dashboard and go to the **API Keys** section
3. Click **Create API Key**, give it a name, and copy the key. It starts with `flo_`
4. Paste it into the `FLOYO_API_KEY` line of your `.env` file

Full step-by-step guide: https://docs.floyo.ai/floyo-api

## Why the key is server-side only

The Floyo API key is read from `.env` on the server. The browser never sees it, never sends it, and the app does not write it to localStorage, sessionStorage, or cookies. This matches how Stripe, Supabase, and other API-key based services recommend handling secret keys.

If the key were exposed in the browser, it could be lifted from devtools, network logs, or a hostile extension and used to drain your Floyo account. Until Floyo ships publishable (origin-restricted) keys, every Floyo call goes through this server.

## Deploy to Vercel

1. Fork this repo
2. Open https://vercel.com and import your fork
3. In **Project Settings, Environment Variables**, add:
   - `FLOYO_API_KEY` set to your `flo_...` key
4. Deploy

A GitHub Action in this repo redeploys automatically on every push to `main`.

If you make the deployed URL public, anyone who can reach it can use your Floyo key. Put it behind Vercel Password Protection, Cloudflare Access, or another auth layer before sharing widely.

Vercel limits serverless request bodies to about 4.5 MB, so very large videos may not upload on production. Local dev allows up to 25 MB.

## How it works

- **Frontend** (`src/`): React with Vite. Holds no secrets. Talks only to its own `/api/*` routes.
- **Backend** (`server/`): Express. Reads `FLOYO_API_KEY` from the environment, builds Floyo workflow JSON, posts to `POST /runs`, and polls until done.
- **Vercel wrappers** (`api/`): Tiny files that re-export the Express app so each route becomes a serverless function.
- **Workflow templates** (`data/`): Reference JSON for the two workflows the app drives (LLM text and Qwen multimodal).

When you attach an image or video, the backend uploads the file to Floyo CDN, then builds a Qwen multimodal workflow with that file as input. Text-only requests use whichever model you picked in the UI.

## Project structure

```
api/         Vercel serverless route files
server/      Express backend
src/         React frontend
data/        Workflow JSON templates
public/      Static assets
```

## Contributing

Issues and pull requests are welcome. If you build something on top of this, share it with us at https://floyo.ai.
