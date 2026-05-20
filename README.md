# FloyoGPT

A ChatGPT-style web app for chatting with 20+ leading LLMs and multimodal models, powered by the [Floyo API](https://floyo.ai). Send text, images, or videos in the same window and get answers as Markdown with syntax-highlighted code blocks.

**Live demo:** https://floyo-llm.vercel.app

## Features

- Chat with many models from one window: Claude, GPT, Gemini, DeepSeek, Grok, Kimi, Llama, MiniMax, Qwen, and more. Type any custom model name too.
- Images and video in the same chat. The app auto-selects Alibaba Qwen 3.5 Plus when you attach media.
- Conversation history kept in your browser. Switch between recent chats from the sidebar.
- Markdown answers with syntax-highlighted code and a one-click copy button on every code block.
- Editable settings for system prompt, temperature, top_p, max tokens, and a reasoning toggle.
- Responsive layout with a collapsible sidebar that works on desktop, tablet, and phone.
- No secrets in the browser. The Floyo API key is read on the server only.

## Run it locally

You need Node.js 18 or newer. Install it from https://nodejs.org if you do not have it.

```bash
git clone https://github.com/FloyoAI/floyo-llm.git
cd floyo-llm
npm install
cp .env.example .env       # Windows (PowerShell): Copy-Item .env.example .env
```

Open `.env` (in the repo root, next to `package.json`) in any text editor and replace the placeholder with your real Floyo API key. The file should look like this:

```bash
# Required. Your Floyo API key. Get one at https://floyo.ai
# Read by the server for every Floyo call. Never exposed to the browser.
FLOYO_API_KEY=flo_your_floyo_api_key_here

# Optional. Uncomment if port 8788 is already in use on your machine.
# PORT=8788
```

Start the app:

```bash
npm run dev
```

You should see something like this in the terminal:

```
FloyoGPT Qwen server listening on http://localhost:8788

  VITE v7.x.x  ready in 180 ms
  ➜  Local:   http://localhost:5174/
```

Open http://localhost:5174 in your browser. That is it.

To stop the app, press `Ctrl+C` in the terminal. To start it again later, just run `npm run dev` from the project folder.

## Get a Floyo API key

1. Sign up at https://floyo.ai
2. Open your dashboard and go to the **API Keys** section
3. Click **Create API Key**, give it a name, and copy the value. It starts with `flo_`
4. Paste it into the `FLOYO_API_KEY` line of your `.env`

Step-by-step guide with screenshots: https://docs.floyo.ai/floyo-api

## Security

The Floyo API key is read from `.env` on the server only. The frontend bundle has no key, the browser never receives one, and the app does not write a key to `localStorage`, `sessionStorage`, or cookies. The only browser storage used is for chat settings, conversation history, and the sidebar collapse preference. This matches how Stripe, Supabase, and other secret-key services recommend handling keys.

## How it works

```
Browser  ──>  Vite dev server (5174)  ──proxy──>  Express (8788)  ──>  Floyo API
   ^                                                                       |
   └──────────────────  React UI  <──────────────────────────────────────  ┘
```

- **Frontend** in `src/` (React 19 + Vite). Talks only to its own `/api/*` routes.
- **Backend** in `server/` (Express 5). Reads `FLOYO_API_KEY` from the environment, builds Floyo workflow JSON, posts to `POST /runs`, polls until the run finishes, and returns the result.
- **Workflow templates** in `data/`. Reference JSON for the two workflows this app drives (LLM text, Qwen multimodal).

When you attach an image or video, the backend uploads the file to Floyo CDN, then builds a Qwen multimodal workflow with that file as input. Text-only requests use whichever model you picked in the UI.

## Project structure

```
server/      Express backend
src/         React frontend
data/        Workflow JSON templates
public/      Static assets
```

## Troubleshooting

**"API key missing" badge at the top of the app**
Your `.env` does not contain `FLOYO_API_KEY`, or the server was started without loading it. Confirm `.env` is in the repo root next to `package.json`, restart `npm run dev`, and refresh the page.

**Floyo returns "Invalid API key"**
The value in `FLOYO_API_KEY` is wrong or has been rotated. Create a new key in your Floyo dashboard, update `.env`, then restart.

**`localhost:5174` does not load**
Check that port 5174 (Vite) and 8788 (Express) are free. If 8788 is taken, uncomment the `PORT=8788` line in `.env` and change it to a free port such as `9001`. Both the backend and the Vite proxy will follow it.

**Conversation history is in a different browser**
History is stored in `localStorage`. It is per-browser, per-device. There is no cloud sync.

## Contributing

Issues and pull requests are welcome. If you build something on top of this, share it with us at https://floyo.ai.
