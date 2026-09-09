# taloni — shared Caddy frontdoor

This repo no longer contains an app of its own — the Finnish property-management TUI/API that
used to live here has moved to its own repo, [StraightUpHouses](https://github.com/mongrelx/StraightUpHouses).
What's left is the **shared Caddy reverse proxy** that fronts every app in the mongrelx family
on one OCI compute instance, plus the GitHub Actions workflow that deploys it.

## How it works

`docker-compose.yml` runs a single `caddy` service (profile `proxy`). `Caddyfile` has one site
block per sibling app, each keyed by that app's own `<PREFIX>_DOMAIN` environment variable —
Caddy reverse-proxies each hostname to that app's own container and provisions a Let's Encrypt
certificate for it automatically. Every sibling app's container joins the same external Docker
network, `frontdoor` (created once, idempotently — the deploy workflow below does this
automatically), which is the only reason Caddy here can reach a container from an entirely
different `docker compose` project.

**Don't own a domain?** [sslip.io](https://sslip.io) gives every IP a free one:
`<label>.<ip-with-dashes>.sslip.io` resolves to that IP with no signup — e.g.
`straightupprogress.203-0-113-1.sslip.io` resolves to `203.0.113.1`. Let's Encrypt treats it like
any other real domain, so this is a genuine trusted certificate with zero DNS setup. This is what
each `<PREFIX>_DOMAIN` should be set to if you don't have your own domain.

Also remember to open the ports you're actually using (80+443) — both the instance's own
firewall (e.g. `iptables`/`ufw`) and, on OCI, the subnet's Security List / any attached Network
Security Group need a rule, or traffic gets silently dropped before it reaches Docker at all.
That's two separate places traffic can be blocked; if something that should work doesn't, check
both.

## Adding a new sibling app

1. In the new app's own repo: copy the Dockerfile/docker-compose.yml/`.github/workflows/deploy-oci.yml`
   pattern from an existing sibling (e.g. `StraightUpProgress`), renaming the container/image. Its
   `docker-compose.yml` should run its own service on the `frontdoor` external network, with no
   published ports/TLS of its own — Caddy here is the only public entry point.
2. Here: add a new site block to `Caddyfile` (`{$<PREFIX>_DOMAIN:<label>.localhost} { reverse_proxy
   <container>:<port> }`) and a matching env var to the `caddy` service in `docker-compose.yml`.
3. Add the four secrets below to the new app's own repo, plus the new `<PREFIX>_DOMAIN` secret
   here (this repo's Caddy is what actually terminates TLS for every sibling hostname, not the
   app's own repo).
4. One-time on the OCI instance: `sudo mkdir -p /opt/<app> && sudo chown ubuntu:ubuntu /opt/<app>`
   (the deploy workflow's `mkdir` step fails with permission denied otherwise, since `/opt` itself
   is root-owned).
5. Trigger both repos' deploy workflows (`gh workflow run "Deploy to OCI" --repo ...`).

This has been done several times now (StraightUpProgress, StraightUpBeats, Kuulutin) as an
additive, backward-compatible diff each time — safe to push straight to `main`.

## Deploying to OCI via GitHub Actions

`.github/workflows/deploy-oci.yml` copies `docker-compose.yml` + `Caddyfile` to a compute
instance over SSH and runs `docker compose pull && up -d`. It's inert (skips entirely) until the
required secrets exist, so merging it does nothing on its own.

### 1. Provision an OCI compute instance

Any small shape works (the free-tier Ampere A1 or E2.1.Micro shapes are enough). On it:

```sh
# Install Docker + the Compose plugin (Ubuntu example)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER   # log out/in for this to take effect
```

Open the security list / network security group for ports 80 and 443.

### 2. Add repository secrets

Settings → Secrets and variables → Actions → New repository secret:

| Secret | Required | Description |
|---|---|---|
| `OCI_HOST` | yes | Instance's public IP or hostname |
| `OCI_SSH_USER` | yes | SSH username (`ubuntu` on Ubuntu images, `opc` on Oracle Linux) |
| `OCI_SSH_KEY` | yes | Private key (PEM) matching a public key already on the instance (`~/.ssh/authorized_keys`) |
| `OCI_DEPLOY_PATH` | no | Remote directory (default `/opt/taloni`) |
| `SUP_DOMAIN` | no | Hostname for StraightUpProgress — see its own `DEPLOYMENT.md` |
| `SUB_DOMAIN` | no | Hostname for StraightUpBeats — see its own `DEPLOYMENT.md` |
| `KUL_DOMAIN` | no | Hostname for Kuulutin — see its own `DEPLOYMENT.md` |
| `LZ_DOMAIN` | no | Hostname for landing zone — see its own `DEPLOYMENT.md` |

GitHub secrets are write-only — they can't be copied between repos via `gh`, only re-entered from
the values above.

### 3. Deploy

Push to `main`, or run the workflow manually from the Actions tab. It will:

1. Copy `docker-compose.yml` and `Caddyfile` to the instance
2. Write the `<PREFIX>_DOMAIN` values into a `.env` file there (not committed to the repo)
3. Create the `frontdoor` network if it doesn't already exist, then run
   `docker compose pull && docker compose --profile proxy up -d`

### Not included

- **OCI Vault** — secrets are handled as GitHub Actions secrets and a `.env` file on the instance,
  not OCI Vault. Wiring up Vault would mean the instance authenticating to OCI's API (instance
  principal or API key), which is its own piece of setup this doesn't attempt.
- **OCI Container Instances / OKE** — this deploys to a plain compute VM over SSH, which needs no
  OCI-specific tooling or API credentials beyond SSH access. Container Instances or OKE would be
  more "cloud-native" but need the OCI CLI/SDK and OCID lookups that weren't specified.
