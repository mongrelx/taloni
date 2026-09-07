# taloni (shared base infra)

This repo used to be the Finnish log-house/property-management app itself. That app moved to
[**StraightUpHouses**](https://github.com/mongrelx/StraightUpHouses) (full history carried over
in the split) — same functionality, same `taloni` CLI command and `~/.taloni` data directory,
new repo/deployment identity.

What's left here is the **shared base infrastructure** for the `StraightUp*` project family on
one OCI compute instance: a single Caddy container acting as a reverse-proxy "frontdoor",
providing automatic Let's Encrypt TLS (via a free [sslip.io](https://sslip.io) hostname — no
domain purchase needed) for every sibling app, each running in its own repo and joining the
shared external `frontdoor` Docker network:

- [StraightUpHouses](https://github.com/mongrelx/StraightUpHouses) — property management (the
  app that used to live in this repo)
- [StraightUpProgress](https://github.com/mongrelx/StraightUpProgress) — vocal training
- [StraightUpBeats](https://github.com/mongrelx/StraightUpBeats) — drum training

See [`DEPLOYMENT.md`](./DEPLOYMENT.md) for how the shared frontdoor works and how a new sibling
project joins it.
