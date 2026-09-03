# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is enabled on this template. See [this documentation](https://react.dev/learn/react-compiler) for more information.

Note: This will impact Vite dev & build performances.

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```
Credit to Vicons Design GB for favicon icon
## Deploying (playing across networks)

InkSync is **two** processes and they deploy separately:

| Part | What it is | Render service type |
| --- | --- | --- |
| `src/` | Static files built by Vite | Static Site |
| `server/index.js` | Long-lived Socket.IO server, all state in memory | Web Service |

The server cannot run on a serverless platform (Vercel, Netlify Functions,
Lambda). It needs a process that stays alive to hold WebSockets open, and its
state lives in memory, so it can't be spread across short-lived instances.

### One-click: the blueprint

[`render.yaml`](../render.yaml) at the repo root defines both services. In
Render: **New → Blueprint**, point it at this repo, apply.

It wires the two together itself — the server's `CLIENT_ORIGIN` is filled from
the static site's hostname and the site's `VITE_SERVER_URL` from the server's,
so there are no URLs to paste. Both services set `rootDir: InkSync`, because
`package.json` sits in a subfolder rather than the repo root.

### Or by hand

Two services, same repo, **Root Directory `InkSync`** on both:

- **Web Service** — build `npm ci`, start `npm start`, health check `/health`.
  Set `CLIENT_ORIGIN` to the static site's URL (comma-separated for several).
- **Static Site** — build `npm ci && npm run build`, publish `dist`.
  Set `VITE_SERVER_URL` to the web service's URL.

A bare hostname works for either; the scheme is added automatically.

### Things that will bite you

- **`VITE_SERVER_URL` is baked in at build time.** Changing it needs a rebuild,
  not a restart. It is also visible to anyone who opens devtools — that is fine,
  it is a public URL, but never put a real secret behind a `VITE_` prefix.
- **Free web services sleep after ~15 minutes idle** and take up to a minute to
  wake. The first person in after a quiet spell will wait. The static site does
  not sleep.
- **State is in memory.** A restart, deploy, or idle spin-down wipes every
  canvas, room and drawing. Persisting would mean moving the canvas snapshots
  and op logs into Redis or Postgres.

### Symptoms of getting it wrong

- **Everyone lands in an empty room, even with the right code.**
  `VITE_SERVER_URL` was missing at build time, so the bundle fell back to
  `http://localhost:3001` — which for each visitor means *their own machine*.
  Check with: `grep -o "localhost:3001" dist/assets/*.js`.
- **The socket never connects, console shows a CORS error.** The site's origin
  is not in `CLIENT_ORIGIN`. The server logs its allowlist on startup.
