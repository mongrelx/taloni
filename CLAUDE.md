# taloni (shared base infra)

Not an app repo. This holds the shared Caddy reverse-proxy "frontdoor" for the `StraightUp*`
project family on one OCI compute instance — see README.md and DEPLOYMENT.md.

The app that used to live here (Finnish log-house/property management, TUI + web) moved to
[StraightUpHouses](https://github.com/mongrelx/StraightUpHouses) with full git history carried
over. Its own CLAUDE.md still documents that app's tech stack/architecture/conventions.

## Files

- `Caddyfile` — one site block per sibling project, each behind its own `*_DOMAIN` env var.
- `docker-compose.yml` — single `caddy` service on the external `frontdoor` network.
- `.github/workflows/deploy-oci.yml` — syncs the two files above to the OCI instance and
  restarts Caddy. No image build — Caddy is a stock public image.

## Adding a new sibling project

1. New project's own `docker-compose.yml` defines its app service on the external `frontdoor`
   network, with an explicit `container_name`, no host ports.
2. Add a site block here in `Caddyfile`: `{$FOO_DOMAIN:foo.localhost} { reverse_proxy
   <container_name>:<port> }`.
3. Add the matching env var to this repo's `docker-compose.yml` `caddy` service and to
   `.github/workflows/deploy-oci.yml`'s secrets/env passthrough.
4. Add a `FOO_DOMAIN` secret here (this repo) and the new project's own `OCI_HOST`/
   `OCI_SSH_USER`/`OCI_SSH_KEY` (same values as this repo's — GitHub secrets are write-only, so
   re-enter them rather than trying to copy via `gh`).
