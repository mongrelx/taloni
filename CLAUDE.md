# taloni

Shared Caddy reverse-proxy frontdoor for the mongrelx app family (StraightUpProgress,
StraightUpBeats, Kuulutin, and future sibling apps), running on one OCI compute instance. No
application code lives here — see DEPLOYMENT.md for how the proxy and deploy workflow work, and
how to add a new sibling app's site block.

- `docker-compose.yml` — the `caddy` service (profile `proxy`), joined to the external `frontdoor`
  Docker network so it can reach every sibling app's own container.
- `Caddyfile` — one reverse-proxy site block per sibling app, each keyed by that app's own
  `<PREFIX>_DOMAIN` environment variable.
- `.github/workflows/deploy-oci.yml` — ships `docker-compose.yml` + `Caddyfile` to the OCI
  instance over SSH and runs `docker compose up -d`.

The taloni property-management app that used to live in this repo is now
[StraightUpHouses](https://github.com/mongrelx/StraightUpHouses).
