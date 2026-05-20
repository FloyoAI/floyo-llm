# FloyoGPT

A ChatGPT-style web app for chatting with 20+ leading LLMs and multimodal models, powered by the [Floyo API](https://floyo.ai). Send text, images, or videos in the same window and get answers as Markdown with syntax-highlighted code blocks.

**Live demo:** https://floyo-llm.vercel.app

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FFloyoAI%2Ffloyo-llm&env=FLOYO_API_KEY&envDescription=Your%20Floyo%20API%20key%20(starts%20with%20flo_)&envLink=https%3A%2F%2Fdocs.floyo.ai%2Ffloyo-api&project-name=floyo-llm&repository-name=floyo-llm)

## Features

- **Chat with many models** from one window: Claude, GPT, Gemini, DeepSeek, Grok, Kimi, Llama, MiniMax, Qwen, and more. Type any custom model name too.
- **Images and video** in the same chat. The app auto-selects Alibaba Qwen 3.5 Plus when you attach media.
- **Conversation history** kept in your browser. Switch between recent chats from the sidebar.
- **Markdown answers** with syntax-highlighted code and a one-click copy button on every code block.
- **Editable settings** for system prompt, temperature, top_p, max tokens, and a reasoning toggle.
- **Responsive layout** with a collapsible sidebar that works on desktop, tablet, and phone.
- **No secrets in the browser.** The Floyo API key lives only on the server. See [Security](#security).

## Quick start (local)

You need Node.js 18 or newer. Install it from https://nodejs.org if you do not have it.

### One-time setup

```bash
git clone https://github.com/FloyoAI/floyo-llm.git
cd floyo-llm
npm install
```

Create a `.env` file in the repo root (next to `package.json`):

```bash
# macOS / Linux
cp .env.example .env

# Windows (PowerShell)
Copy-Item .env.example .env
```

Open `.env` in any text editor (VS Code, Sublime, Notepad, nano) and paste your Floyo API key on the `FLOYO_API_KEY` line:

```bash
FLOYO_API_KEY=flo_your_real_key_here
```

### Run the app

```bash
npm run dev
```

You should see something like this in the terminal:

```
FloyoGPT Qwen server listening on http://localhost:8788

  VITE v7.x.x  ready in 180 ms
  ➜  Local:   http://localhost:5174/
```

Now open http://localhost:5174 in your browser. The app is ready to use.

To stop the app, press `Ctrl+C` in the terminal. To start it again later, just run `npm run dev` from the project folder.

## Get a Floyo API key

1. Sign up at https://floyo.ai
2. Open your dashboard and go to the **API Keys** section
3. Click **Create API Key**, give it a name, and copy the value. It starts with `flo_`
4. Paste it into the `FLOYO_API_KEY` line of your `.env`

Step-by-step guide with screenshots: https://docs.floyo.ai/floyo-api

## Deploy to Vercel

The fastest way is the one-click button at the top of this README. It will fork the repo, prompt you for `FLOYO_API_KEY`, and deploy.

To deploy manually:

1. Fork this repo on GitHub
2. Go to https://vercel.com and click **Add New > Project**
3. Pick your fork
4. In **Settings > Environment Variables**, add `FLOYO_API_KEY` with your `flo_...` key
5. Click **Deploy**

A GitHub Action included in this repo redeploys the project on every push to `main`. No extra setup needed if you used the Vercel GitHub integration. If your Vercel project uses a deploy hook instead, add the hook URL as a repo secret named `VERCEL_DEPLOY_HOOK_URL` and the existing workflow will pick it up.

> **Important:** This project does not include user authentication. If you make the deployed URL public, anyone who can reach it can use your Floyo key. Put it behind Vercel Password Protection, Cloudflare Access, or another auth layer before sharing it widely. For internal team use the bare URL is fine.

## Environment variables

| Variable | Required | What it does |
| --- | --- | --- |
| `FLOYO_API_KEY` | Yes | Your Floyo API key (`flo_...`). Read by the server for every Floyo call. |
| `FLOYO_API_BASE_URL` | No | Defaults to `https://api.floyo.ai`. Override only if pointing at a non-default Floyo environment. |
| `FLOYO_CDN_URL` | No | Defaults to `https://cdn.floyo.ai`. Same as above. |
| `PORT` | No | Local backend port. Defaults to `8788`. The Vite dev server reads it too, so the proxy follows whichever port you set. |

Set the same variables in **Vercel Project Settings > Environment Variables** for production.

## Security

The Floyo API key is read from the environment on the **server only**. The frontend bundle has no key, the browser never receives one, and the app does not write a key to `localStorage`, `sessionStorage`, or cookies. The only browser storage used is for chat settings, conversation history, and the sidebar collapse preference.

This is the same pattern Stripe, Supabase, and similar services recommend for secret keys. A key exposed in the browser can be lifted from devtools, network logs, or a hostile extension and used to drain your Floyo account. Until Floyo ships publishable, origin-restricted keys, every Floyo call in this app goes through the server.

If you are upgrading from an older build that did prompt for a key in the UI, the app removes any legacy entries from `localStorage` and `sessionStorage` on first load.

## How it works

```
Browser  ──>  Vite dev server (5174)  ──proxy──>  Express (8788)  ──>  Floyo API
   ^                                                  |
   |                  Vercel functions  <─────────────|  (one wrapper per route)
   |                          |
   └───────  React UI  <──────┘
```

- **Frontend** in `src/` (React 19 + Vite). Talks only to its own `/api/*` routes.
- **Backend** in `server/` (Express 5). Reads `FLOYO_API_KEY` from the environment, builds Floyo workflow JSON, posts to `POST /runs`, polls until the run finishes, and returns the result.
- **Vercel wrappers** in `api/`. Each file re-exports the Express app so the route becomes a serverless function on Vercel.
- **Workflow templates** in `data/`. Reference JSON for the two workflows this app drives (LLM text, Qwen multimodal).

When you attach an image or video, the backend uploads the file to Floyo CDN, then builds a Qwen multimodal workflow with that file as input. Text-only requests use whichever model you picked in the UI.

## Project structure

```
api/         Vercel serverless route files
server/      Express backend
src/         React frontend
data/        Workflow JSON templates
public/      Static assets
.github/     GitHub Actions (auto-deploy on push)
```

## Troubleshooting

**The header shows "API key missing"**
Your `.env` does not contain `FLOYO_API_KEY`, or the server was started without loading it. Confirm `.env` is in the repo root, restart `npm run dev`, and refresh the page.

**Floyo returns "Invalid API key"**
The value in `FLOYO_API_KEY` is wrong or has been rotated. Create a new key in your Floyo dashboard and update `.env` (or Vercel env vars), then restart.

**Large video upload fails on Vercel**
Vercel serverless functions cap request bodies at about 4.5 MB. Local dev allows up to 25 MB through multer. Use shorter clips for production until Floyo CDN supports direct browser uploads.

**`localhost:5174` does not load**
Check that port 5174 (Vite) and 8788 (Express) are free. If 8788 is taken, set a different `PORT` in `.env` and both the backend and the Vite proxy will follow.

**Conversation history shows in a different browser**
History is stored in `localStorage`. It is per-browser, per-device. There is no cloud sync.

## Contributing

Issues and pull requests are welcome. If you build something on top of this, share it with us at https://floyo.ai.

## License

Add a `LICENSE` file at the repo root before publishing. MIT is a common choice for open source.
