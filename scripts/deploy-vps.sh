#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"
SSH_HOST="${PORTFOLIO_SSH_HOST:-vps}"
REMOTE_DIR=/home/ubuntu/apps/portfolio
RELEASE="$(git rev-parse --short=12 HEAD)-$(date -u +%Y%m%dT%H%M%SZ)"
SSH_OPTIONS=(-o BatchMode=yes -o ConnectTimeout=15)

# Reuse the tested build only while its source and output fingerprints match.
# Otherwise build and run the quick checks before touching the running release.
node scripts/check.mjs --reuse
[[ -s dist/index.html && -d dist/assets ]] || { echo 'Missing production build.' >&2; exit 1; }

ssh "${SSH_OPTIONS[@]}" "$SSH_HOST" \
  "mkdir -p '$REMOTE_DIR/infra' '$REMOTE_DIR/site/releases/$RELEASE'; install -d -m 700 '$REMOTE_DIR/secrets'"
rsync -az -e 'ssh -o BatchMode=yes -o ConnectTimeout=15' \
  infra/portfolio/Caddyfile "$SSH_HOST:$REMOTE_DIR/infra/Caddyfile"
rsync -az -e 'ssh -o BatchMode=yes -o ConnectTimeout=15' \
  infra/portfolio/docker-compose.yml "$SSH_HOST:$REMOTE_DIR/docker-compose.yml"
rsync -az -e 'ssh -o BatchMode=yes -o ConnectTimeout=15' \
  dist/ "$SSH_HOST:$REMOTE_DIR/site/releases/$RELEASE/"

ssh "${SSH_OPTIONS[@]}" "$SSH_HOST" bash -s -- "$REMOTE_DIR" "$RELEASE" <<'REMOTE'
set -euo pipefail
cd "$1"
release="$2"
exec 9>.deploy.lock
flock -n 9 || { echo 'Another portfolio deploy is running.' >&2; exit 1; }

docker compose run --rm --no-deps -T caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile < /dev/null
previous="$(readlink site/current || true)"
if [[ -n "$previous" ]]; then
  # Keep previously published hashes available for visitors with older HTML.
  rsync -a --ignore-existing site/current/assets/ "site/releases/$release/assets/"
fi
ln -sfn "releases/$release" site/current-next
mv -Tf site/current-next site/current

rollback() {
  if [[ -n "$previous" ]]; then
    ln -sfn "$previous" site/current-rollback
    mv -Tf site/current-rollback site/current
    echo "Restored previous portfolio release: $previous" >&2
  fi
}
trap rollback ERR
docker compose up -d --wait caddy
# Caddy configuration is mounted as a directory; restart only when it changed.
# Site updates are atomic symlink changes and require no process restart.
config_hash="$(sha256sum infra/Caddyfile | cut -d ' ' -f 1)"
if [[ -f .caddy-config-sha && "$(cat .caddy-config-sha)" != "$config_hash" ]]; then
  docker compose restart caddy
fi
curl --retry 5 --retry-connrefused --retry-delay 1 -fsS http://127.0.0.1:8088/healthz | grep -qx ok
curl -fsS http://127.0.0.1:8088/ | grep '<title>Caleb Habesh</title>' > /dev/null
printf '%s\n' "$config_hash" > .caddy-config-sha
printf '%s\n' "$release" > .current-release
trap - ERR
echo "Portfolio origin ready: $release"
REMOTE
