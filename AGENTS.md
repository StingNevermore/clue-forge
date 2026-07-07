# AGENTS.md

## Cloudflare / Wrangler

- Use the user's normal Wrangler login when checking real Cloudflare state. Do not set `XDG_CONFIG_HOME=/private/tmp/...` for commands that need account auth, because that hides the browser-login credentials stored under `~/Library/Preferences/.wrangler/config/default.toml`.
- If Wrangler fails with `EPERM` writing logs under `~/Library/Preferences/.wrangler/logs` or cannot resolve `api.cloudflare.com` inside the sandbox, rerun the same read-only Wrangler command with `sandbox_permissions: "require_escalated"`.
- Use temporary `XDG_CONFIG_HOME` only for unauthenticated local checks such as dry-runs or build validation where Cloudflare account state is irrelevant.
- For deployment verification, prefer actual Wrangler state:
  - `pnpm -C apps/api exec wrangler deployments list --config wrangler.jsonc`
  - `pnpm -C apps/web exec wrangler pages deployment list --project-name clue-forge-web`
- Confirm the deployed app with HTTP checks after Wrangler reports success:
  - `curl -s -I https://clue-forge-web.pages.dev`
  - `curl -s https://clue-forge-web.pages.dev/api/health`
