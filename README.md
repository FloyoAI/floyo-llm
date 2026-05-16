# FloyoGPT

An open-source ChatGPT-style web app powered by the [Floyo API](https://floyo.ai). Chat with 20+ leading LLMs, drop in an image or video, and get multimodal answers, all from one window.

**Live demo:** https://floyo-llm.vercel.app

## What you get

- Familiar chat interface with conversation history saved in your browser
- 20+ models to choose from (Claude, GPT, Gemini, DeepSeek, Grok, Qwen, and more), plus a Custom field for any model name
- Image and video uploads. The app automatically switches to Alibaba Qwen 3.5 Plus when you attach media
- Markdown answers with code highlighting and a one-click copy button on every code block
- System prompt, temperature, top_p, max tokens, and reasoning toggle all editable in the UI
- One codebase that works the same on your laptop and on Vercel

## Quick start

You need:

- Node.js 18 or newer
- A Floyo API key (steps below)

Clone, install, and copy the env file:

```bash
git clone https://github.com/ritik-devsecops/floyo-llm.git
cd floyo-llm
npm install
cp .env.example .env
```

Open `.env` and fill in:

```bash
FLOYO_API_KEY=flo_paste_your_real_key_here
APP_ACCESS_TOKEN=any_long_random_string_you_choose
```

Run the app:

```bash
npm run dev
```

Open http://localhost:5174 in your browser. The backend runs on http://localhost:8788.

## Get a Floyo API key

1. Sign up at https://floyo.ai
2. Open your dashboard and go to the API Keys section
3. Click "Create API Key", give it a name, and copy the key. It starts with `flo_`
4. Paste it into your `.env` file as `FLOYO_API_KEY`

Full step-by-step instructions: https://docs.floyo.ai/floyo-api

## Environment variables

| Name | Required | Purpose |
| --- | --- | --- |
| `FLOYO_API_KEY` | Yes | Your Floyo API key. Used as the server default. |
| `APP_ACCESS_TOKEN` | Yes in production | A private token the frontend sends to unlock requests. Choose any 32+ character random string. Anyone who has this token can use your Floyo key, so keep it secret. |
| `FLOYO_API_BASE_URL` | No | Defaults to `https://api.floyo.ai` |
| `FLOYO_CDN_URL` | No | Defaults to `https://cdn.floyo.ai` |
| `PORT` | No | Local backend port. Defaults to `8788` |

In production, users can also paste their own Floyo API key directly into the app, in which case `APP_ACCESS_TOKEN` is not needed for that session.

## Deploy to Vercel

1. Fork this repo on GitHub
2. Go to https://vercel.com and click "Import Project"
3. Pick your fork
4. In Project Settings, add the four environment variables above
5. Deploy

That is the full setup. Future pushes to `main` redeploy automatically.

Note: Vercel limits request bodies to about 4.5 MB, so very large video uploads will fail on production. Local dev allows up to 25 MB.

## How it works

- **Frontend** (`src/`): React and Vite. API keys are kept in memory only, never written to disk.
- **Backend** (`server/`): Express. Takes chat requests, builds a Floyo workflow JSON, and posts to Floyo's `POST /runs`, then polls until the run finishes.
- **Vercel wrappers** (`api/`): Tiny files that re-export the Express app so each endpoint becomes a serverless function.
- **Workflow templates** (`data/`): Reference JSON for the two workflows the app drives (text LLM and Qwen multimodal).

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

## License

MIT (add your own `LICENSE` file before publishing).
