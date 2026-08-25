# Bifrost → Dokploy Deployment (bifrost01.adiskandar.com)

Personal deployment pipeline for this fork. Ships the working tree to the
Dokploy-hosted production instance. Not part of upstream Bifrost docs.

## Architecture

```
push to fork dev (or manual dispatch)
  → GitHub Actions: push-dokploy.yml
    → build linux/amd64 base from transports/Dockerfile.local
      (go-workspace build = actual working-tree code; the plain Dockerfile
      resolves PUBLISHED module versions and silently ships stale code on
      branches ahead of releases — never use it for this)
    → overlay transports/Dockerfile.dokploy
      (nodejs + claude-code@2.1.207 + su-exec privilege drop, replicating
      the old Dokploy dockerfile_inline)
    → docker save | gzip | ssh → server runs forced command:
      gunzip | docker load → retag :incoming → :latest →
      docker compose -p bifrost01-compose-2wbogg up -d --wait → health check
```

No registry. The server is the image store (`bifrost-dokploy:latest`).

## Deploying

- **Auto**: push to `dev` on `is911/bifrost`
- **Manual (any branch)**:
  ```bash
  gh workflow run push-dokploy.yml -R is911/bifrost --ref <branch> -f ref=<branch>
  ```
  The branch must contain both `.github/workflows/push-dokploy.yml` and
  `transports/Dockerfile.dokploy` (the `dokploy-ci` branch carries them on
  top of feature work; rebase picks them up).

Build cache (GHA, mode=max) is warm — runs take ~3-6 min. A failed health
check fails the run; deploy status lands in the job summary.

## Server-side facts

| What | Where |
|---|---|
| SSH alias (this Mac) | `dokploy` → root@dokploy.adiskandar.com |
| Compose project | `bifrost01-compose-2wbogg` |
| Compose dir | `/etc/dokploy/compose/bifrost01-compose-2wbogg/code/` |
| Compose source of truth | Dokploy postgres, `compose` row `sDWl2c2BIDoQ5mDxevd1p` — UI deploys regenerate the on-disk file from the DB; edit the DB (or UI), not just the file |
| CI deploy key | `gh-actions-bifrost-dokploy` in `/root/.ssh/authorized_keys`, `restrict,command="..."` — can only run the deploy sequence |
| Data volumes | `.../bifrost01-compose-2wbogg/{data,claude-config}` |
| Secrets (GitHub) | `DOKPLOY_SSH_KEY`, `DOKPLOY_KNOWN_HOSTS` |

## Rollback

1. Old compose backup: `dokploy:/root/bifrost01-compose-backup-20260825.yml`
   (restores the `maximhq/bifrost:latest` + dockerfile_inline setup)
2. Restore it into the Dokploy DB row (dollar-quoted SQL via psql) and the
   on-disk file, then `docker compose -p bifrost01-compose-2wbogg up -d --wait`
3. Previous image `bifrost01-compose-2wbogg-bifrost-custom:latest` is kept
   on the server

To redeploy an older commit: `gh workflow run ... -f ref=<sha>` (rebuilds
from cache).

## Gotchas learned

- **Runs stuck `queued` with zero jobs** = Actions disabled on the repo
  (`gh api repos/is911/bifrost/actions/permissions`). Enable with
  `-F enabled=true -F allowed_actions=all`. Happened 2026-08-25.
- Dispatch `--ref X` + `-f ref=X`: the input default is `dev`; forgetting
  `-f ref` builds dev code from a feature-branch workflow ref.
- Pushing CI commits to fork `dev` auto-triggers a deploy of (featureless)
  dev code — cancel the push-event run if a feature dispatch follows.
- Dokploy UI "deploy" runs compose from the DB copy; the disk file is
  disposable.
