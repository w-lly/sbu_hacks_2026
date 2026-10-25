# Brassworks Transit

A standalone factory rail-logistics game built with TanStack Start and React.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

All artwork and fonts are stored in `src/assets` and bundled directly. No hosted
image proxy, external font request or platform service is required to play.
Existing `.asset.json` files are internal provenance records only; the application
does not import them. Keep a downloaded local copy whenever adding artwork.

For optional AI reports, copy `.env.example` to `.env.local` and configure
`GEMINI_API_KEY`. Without a key, or if the service fails, the Chief Engineer uses
the existing rule-based feedback. Keys stay server-side.

## Build and deployment

Run `npm test` for regressions and `npm run build` for production. Standard Vite
plugins build the client into `dist/client` and the Cloudflare-compatible server
into `dist/server`. Configure `GEMINI_API_KEY` as a server secret on the deployment
host only if AI reports are wanted. The Nitro preset in `vite.config.ts` can be
changed for another supported hosting target; no platform account is required.

## Built with

- TanStack Start
- TypeScript
- React
- Tailwind CSS
