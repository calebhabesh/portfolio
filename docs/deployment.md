# Portfolio on the VPS

The static portfolio runs as its own Docker Compose project at
`/home/ubuntu/apps/portfolio`. It does not depend on LineWatchTO's containers,
network, deployment checkout, or Caddy configuration.

The request path is Cloudflare HTTPS → a dedicated `portfolio` Cloudflare Tunnel
→ `http://127.0.0.1:8088` on the VPS → the portfolio Caddy container. The origin
port is bound to loopback only; no firewall or public port changes are needed.
Cloudflare provides public TLS; the local loopback hop uses HTTP.

## First Cloudflare setup

The domain is already on Cloudflare. Account access is needed to create the tunnel
and change DNS. Follow [Cloudflare's tunnel setup guide](https://developers.cloudflare.com/tunnel/get-started/).

1. In the Cloudflare dashboard, select the account containing `calebhabesh.com`.
   Open **Networking → Tunnels → Create Tunnel** and name it `portfolio`.
   Depending on the dashboard, the equivalent page is in Cloudflare One under
   **Networks → Connectors → Cloudflare Tunnels**. Select the `cloudflared` tunnel
   type if prompted.
2. Copy only the token from the connector command, after `--token`. The connector
   is installed by the setup wizard; do not run Cloudflare's sample install command.
   The wizard saves the token with mode `0600` at
   `/home/ubuntu/apps/portfolio/secrets/tunnel-token`, owned by the VPS user
   (`1001:1001`), and starts the separate tunnel container.
3. Once the connector is healthy, add two **Published application** routes:

   | Hostname | Service type | Service URL |
   | --- | --- | --- |
   | `calebhabesh.com` (blank subdomain) | HTTP | `127.0.0.1:8088` |
   | `www.calebhabesh.com` | HTTP | `127.0.0.1:8088` |

   Leave **HTTP Host Header** unset to preserve the visitor's hostname. Caddy
   redirects `www` to the apex domain. Do not put Cloudflare Access authentication
   in front of this public site.
4. If Cloudflare reports an existing DNS record, first save the existing web
   records for rollback, then remove only the old A/AAAA/CNAME records for `@` and
   `www` that point to GitHub Pages. Saving the tunnel routes creates proxied
   CNAME records pointing to `<tunnel-id>.cfargotunnel.com`. Preserve MX, TXT, and
   unrelated records. No registrar or nameserver change is expected.
5. For the domain, enable **SSL/TLS → Edge Certificates → Always Use HTTPS** and
   confirm Universal SSL is active. This prevents visitors from remaining on HTTP.
   Origin certificate settings do not need changing for this local HTTP tunnel.
6. Check `https://calebhabesh.com/` and the `www` redirect. Configure an external
   uptime monitor for the homepage with a `Caleb Habesh` content check and alerts
   to your own email. Monitoring is an account-side step, not yet configured here.

For this first setup, run the generated local wizard:

```bash
bash .artifacts/setup-cloudflare.sh
```

The wizard keeps a private local copy of the token in the ignored `.artifacts/`
directory for retries, and transfers it over SSH without placing it in a shell
command argument. Never commit or paste that token into chat.

## Updates

From the development checkout, run:

```bash
bash scripts/deploy-vps.sh
```

The script reuses the local build if it passed `npm run check` or
`npm run check:full` and the source and output contents are unchanged. Otherwise
it builds locally and runs the quick checks before contacting the VPS. Running
`npm run build` alone does not qualify a build for reuse. For broad layout,
rendering, or startup changes, run `npm run check:full` before deployment.

The script uploads a complete release, validates Caddy, and
atomically switches the `site/current` symlink. Existing assets remain available
for visitors who loaded an older page. Updating static files does not restart
Caddy or the tunnel. Both containers have restart policies, memory/CPU ceilings,
and rotated logs. Images are pinned by digest; update them deliberately rather
than relying on a moving `latest` tag.

On the VPS:

```bash
cd /home/ubuntu/apps/portfolio
docker compose --profile tunnel ps
curl -fsS http://127.0.0.1:8088/healthz
curl -fsS http://127.0.0.1:20088/ready
```

Caddy's Docker health check reports origin liveness. Docker restart policies
restart exited processes and start containers after a reboot; an unhealthy
health check alone does not restart a container. External monitoring is needed
to report failures across DNS, Cloudflare, the tunnel, and the origin.

## Rollback and availability

Releases live under `site/releases/`. To roll back, pick a prior directory and
replace the symlink atomically:

```bash
cd /home/ubuntu/apps/portfolio/site
ln -s releases/<previous-release> current-rollback
mv -Tf current-rollback current
```

Do not delete the release targeted by `current`. Release directories are retained
for manual rollback and are small; review their disk use periodically.

This isolates the portfolio from LineWatchTO releases but still depends on one
VPS, its Docker daemon, the tunnel, and Cloudflare. It is not a multi-host failover
setup. HTML revalidates and Vite's hashed assets cache for one year; this caching
does not guarantee the homepage remains available during a VPS outage.
