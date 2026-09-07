# Shared base infra: the OCI frontdoor

This repo used to run the Finnish log-house app (`taloni serve`) directly, with an optional
Caddy TLS profile in front of it. That app moved to
[StraightUpHouses](https://github.com/mongrelx/StraightUpHouses) (full git history carried
over — see that repo's own DEPLOYMENT.md for how it deploys). This repo is now **just the shared
Caddy frontdoor** that StraightUpHouses and every other `StraightUp*` sibling project sits
behind on the same OCI compute instance.

## How it works

`docker-compose.yml` here defines a single `caddy` service, joined to an external Docker network
called `frontdoor`. Each sibling project's own `docker-compose.yml` defines its own app service
also joined to `frontdoor`, with an explicit `container_name` and no host ports of its own —
Caddy is the only thing bound to 80/443, and reaches each sibling app by container name over
that shared network (e.g. `reverse_proxy straightuphouses:3000`).

`Caddyfile` has one site block per project, each keyed off its own `*_DOMAIN` environment
variable, so Caddy auto-provisions a separate Let's Encrypt certificate per hostname. Don't own a
domain? [sslip.io](https://sslip.io) gives you one for free: `<ip-with-dots>.sslip.io` resolves
to that IP with no signup, and Let's Encrypt treats it like any other real domain.

## 1. Provision an OCI compute instance (one-time)

Any small shape works (the free-tier Ampere A1 or E2.1.Micro shapes are enough). On it:

```sh
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER   # log out/in for this to take effect
docker network create frontdoor
```

Open the instance's firewall, its OCI Security List/Network Security Group, and any other
network layer for ports 80 and 443 — all three need a rule or traffic is silently dropped before
reaching Docker.

## 2. Add repository secrets (this repo)

Settings → Secrets and variables → Actions → New repository secret:

| Secret | Required | Description |
|---|---|---|
| `OCI_HOST` | yes | Instance's public IP or hostname |
| `OCI_SSH_USER` | yes | SSH username (`ubuntu` on Ubuntu images, `opc` on Oracle Linux) |
| `OCI_SSH_KEY` | yes | Private key (PEM) matching a public key already on the instance |
| `OCI_DEPLOY_PATH` | no | Remote directory (default `/opt/taloni`) |
| `OCI_DOMAIN` | no | Hostname for whichever site should own the Caddyfile's default (`$DOMAIN`) block |
| `SUP_DOMAIN` | no | StraightUpProgress's hostname — see its own DEPLOYMENT.md |
| `SUB_DOMAIN` | no | StraightUpBeats's hostname — see its own DEPLOYMENT.md |

Each sibling project repo needs its **own** copy of `OCI_HOST`/`OCI_SSH_USER`/`OCI_SSH_KEY` (same
values as here) plus its own `*_DOMAIN` secret — GitHub secrets are write-only, so re-enter them
from wherever they're kept rather than trying to copy via `gh`.

## 3. Deploy

Push to `main` (when `Caddyfile`/`docker-compose.yml` change), or run the workflow manually. It
copies both files to the instance and runs `docker compose up -d` — no image build, Caddy is a
stock public image.

Each sibling project deploys itself independently via its own `deploy-oci.yml`, which also runs
`docker network create frontdoor 2>/dev/null || true` so it's safe regardless of deploy order.

## Adding a new sibling project

See `CLAUDE.md`'s "Adding a new sibling project" section.

## Not included

- **Its own TLS story beyond Caddy's automatic Let's Encrypt** — no manual cert management.
- **OCI Vault** — secrets are handled as GitHub Actions secrets and a `.env` file per-project on
  the instance, not OCI Vault.
- **OCI Container Instances / OKE** — this deploys to a plain compute VM over SSH.
