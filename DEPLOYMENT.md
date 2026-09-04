# Deploying the taloni API

`taloni serve` runs a REST API over the same SQLite database the TUI uses, and serves a small
Vue-based web UI (properties, tasks, alerts, portfolio) from the same address — `npm run build`
builds both (see [Web UI](#web-ui) below). This document covers running it in Docker, and
deploying it to an OCI (Oracle Cloud Infrastructure) compute instance via the `deploy-oci.yml`
GitHub Actions workflow.

The interactive TUI (`taloni` with no arguments) is not meant to run in a container — only
`taloni serve` is.

## Web UI

The web app lives in `web/` as its own npm project (Vue 3 + Vite), built separately from the CLI
and copied into `dist/web` by the root `npm run build`. It's a thin client over the REST API
below — same-origin `fetch` calls, an API key entered once and stored in `localStorage`. Nothing
in the built assets is secret, so it's served without authentication (the API itself still is).

For frontend-only iteration: run `taloni serve` in one terminal, then `npm run dev` inside `web/`
in another — Vite proxies `/api` and `/health` to `localhost:3000` (see `web/vite.config.ts`) with
hot reload. It intentionally doesn't cover every entity in the API — properties, tasks (with
add/complete), alerts, and the portfolio comparison, matching the CLI's original priorities
(`add-task`/`add-tx`) rather than the full 18-resource CRUD surface.

## Authentication

The API is protected by a single shared API key, checked against `Authorization: Bearer <key>`
on every request except `GET /health`. Set it explicitly for any real deployment:

```
TALONI_API_KEY=<a long random string>
```

If unset, the server generates one on first run and saves it to `~/.taloni/api_key` (inside the
container: `/home/node/.taloni/api_key`, which is why that path is a volume — losing it means
losing the generated key). For anything beyond local testing, set `TALONI_API_KEY` explicitly so
the key doesn't depend on volume persistence and so you know it up front.

There are no user accounts or scopes — anyone with the key has full read/write access to every
resource. Treat it like a root password.

## Running locally with Docker

```sh
export TALONI_API_KEY=$(openssl rand -base64 24)
docker compose up -d taloni
curl http://localhost:3000/health
curl http://localhost:3000/api/properties -H "Authorization: Bearer $TALONI_API_KEY"
```

Or open `http://localhost:3000` in a browser for the web UI — it'll prompt for the API key above.

Data (the SQLite database and, if generated, the API key) lives in the `taloni-data` named
volume, mounted at `/home/node/.taloni`. It survives `docker compose down`; `docker compose down
-v` removes it.

## TLS via Caddy (recommended — this is the default in the OCI workflow)

`docker-compose.yml` includes a `caddy` service (profile `proxy`) that reverse-proxies to
`taloni` and provisions a Let's Encrypt certificate automatically once `DOMAIN` points a real
DNS name at the host. `taloni`'s own port (3000) isn't published to the host at all by default —
Caddy is the only way in, so the API key never travels unencrypted.

**Don't own a domain?** [sslip.io](https://sslip.io) gives you one for free: `<ip-with-dots>.sslip.io`
resolves to that IP with no signup — e.g. `203.0.113.1.sslip.io` resolves to `203.0.113.1`. Let's
Encrypt treats it like any other real domain, so this gets you a genuine trusted certificate with
zero DNS setup. This is what `OCI_DOMAIN` should be set to if you don't have your own domain.

```sh
export TALONI_API_KEY=$(openssl rand -base64 24)
export DOMAIN=api.example.com   # or: 203.0.113.1.sslip.io
docker compose --profile proxy up -d
```

Without a real `DOMAIN` (including sslip.io), Caddy falls back to `localhost` with its own
internal (self-signed) CA — fine for local testing, not for a real deployment.

If you'd rather skip Caddy/TLS entirely (e.g. local testing with a real IP, no domain needed),
uncomment `ports: - '3000:3000'` on the `taloni` service and run `docker compose up -d taloni`
without the `proxy` profile — but then the API key travels unencrypted, so don't do this for
anything reachable outside a trusted network.

### Sharing this Caddy with another project

This Caddy instance also fronts the **StraightUpProgress** project on the same OCI compute
instance — a second site block in `Caddyfile` reverse-proxies `SUP_DOMAIN` to that project's
container. It's reachable only because both `caddy` here and StraightUpProgress's `app` service
join a shared external Docker network called `frontdoor` (created once with
`docker network create frontdoor`; the deploy workflow does this automatically, idempotently,
whichever project deploys first). See `../StraightUpProgress/DEPLOYMENT.md` for that side of it.

Also remember to open the ports you're actually using — both the instance's own firewall (e.g.
`iptables`/`ufw`) and, on OCI, the subnet's Security List / any attached Network Security Group
all need a rule, or traffic gets silently dropped before it reaches Docker at all. That's three
separate places traffic can be blocked; if something that should work doesn't, check all three.

## Deploying to OCI via GitHub Actions

`.github/workflows/deploy-oci.yml` builds the image, pushes it to `ghcr.io/<owner>/taloni`, then
SSHes into a compute instance and runs `docker compose pull && up -d`. It's inert (skips
entirely) until the required secrets exist, so merging it does nothing on its own.

### 1. Provision an OCI compute instance

Any small shape works (the free-tier Ampere A1 or E2.1.Micro shapes are enough). On it:

```sh
# Install Docker + the Compose plugin (Ubuntu example)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER   # log out/in for this to take effect
```

Open the security list / network security group for whichever ports you'll use: 3000 (direct
HTTP) or 80+443 (via Caddy) — not both.

### 2. Add repository secrets

Settings → Secrets and variables → Actions → New repository secret:

| Secret | Required | Description |
|---|---|---|
| `OCI_HOST` | yes | Instance's public IP or hostname |
| `OCI_SSH_USER` | yes | SSH username (`ubuntu` on Ubuntu images, `opc` on Oracle Linux) |
| `OCI_SSH_KEY` | yes | Private key (PEM) matching a public key already on the instance (`~/.ssh/authorized_keys`) |
| `TALONI_API_KEY` | yes | The key the deployed server will require |
| `OCI_DEPLOY_PATH` | no | Remote directory (default `/opt/taloni`) |
| `OCI_DOMAIN` | no | If set, deploys with the Caddy TLS profile instead of plain HTTP on 3000 |
| `SUP_DOMAIN` | no | Hostname for the StraightUpProgress site, a separate project sharing this same Caddy — see its own `DEPLOYMENT.md` |

### 3. Deploy

Push to `main`, or run the workflow manually from the Actions tab. It will:

1. Build the image and push `ghcr.io/<owner>/taloni:latest` and `:<commit-sha>`
2. Copy `docker-compose.yml` and `Caddyfile` to the instance
3. Write `TALONI_API_KEY` and `DOMAIN` into a `.env` file there (not committed to the repo)
4. Run `docker compose pull && docker compose up -d` (adding `--profile proxy` when `OCI_DOMAIN`
   is set)

### Not included

- **Managed PostgreSQL / OCI Database** — taloni uses SQLite via `node:sqlite`, which is used
  directly throughout the codebase (not through an abstraction that could swap backends). Moving
  to Postgres is a genuinely separate, large change (see issue #17) and isn't part of this setup;
  the SQLite file lives on the `taloni-data` Docker volume instead.
- **OCI Vault** — secrets are handled as GitHub Actions secrets and a `.env` file on the instance,
  not OCI Vault. Wiring up Vault would mean the instance authenticating to OCI's API (instance
  principal or API key), which is its own piece of setup this doesn't attempt.
- **OCI Container Instances / OKE** — this deploys to a plain compute VM over SSH, which needs no
  OCI-specific tooling or API credentials beyond SSH access. Container Instances or OKE would be
  more "cloud-native" but need the OCI CLI/SDK and OCID lookups that weren't specified.
