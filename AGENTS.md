# Wanderlight development branch

- The user preserves the current v1.0.0 production website. Implement future changes on `develop` or a feature branch based on it.
- Stable baseline: `d4e90ff37112d1524eb3cea147ccf3f10438fa44`, remote branch `stable-v1.0.0`. Do not move the baseline or make ordinary development changes on `main`.
- Merge or publish to production only when the user explicitly requests or approves a stable release. Direct user instructions take precedence.
- Development preview: `npm run dev` or `node scripts/serve-dev.mjs`, http://localhost:4176/. Keep development storage separate from the stable local port 4173 and the production hostname.
- Keep the `main`-only guard in `.github/workflows/pages.yml`. `.github/workflows/development.yml` is validation only and must not deploy to production.
- An online preview needs a separate hosting project and hostname. Do not use this repository's production Pages deployment as a preview, or copy an existing Sites hosting identity.
- Source snapshots do not include browser records or photos. Back up data before storage migrations, and never commit personal travel backups or photos.
- See `docs/VERSIONING.md` for the release and recovery procedure.
