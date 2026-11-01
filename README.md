# AI Interview Agent

Sample to do the exercise in session 2.

A Vite chatbot that helps you prepare for AI job interviews, powered by Gemini (`gemini-3.8-flash`).

Pick a role and the coach tailors its answers, mock questions and feedback to it:

- **AI Product Manager**: product sense, AI strategy, metrics and evals
- **Forward Deployed Engineer**: customer scenarios, RAG/agents, system design, debugging
- **AI Researcher**: ML fundamentals, experiment design, paper discussion, coding from scratch

Each role has its own accent color and its own conversation history.

## Run it

Requires Node.js 18+.

```bash
npm install
npm run dev
```

Open the printed URL and paste your Gemini API key (from https://aistudio.google.com/apikey) when prompted.
The key is stored only in your browser and is sent only to Google's Gemini API.

## Build

```bash
npm run build
```

The static site is written to `dist/`.

## Files

- `src/roles.js`: role prompts, starter questions and colors
- `src/gemini.js`: streaming call to the Gemini API
- `src/main.js`: UI logic
- `src/markdown.js`: safe Markdown rendering for replies
- `src/style.css`: blue/neon grid theme
