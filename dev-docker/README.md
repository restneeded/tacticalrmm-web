# Phase A dev container — Tactical RMM web fork

Bring up the live Quasar dev server (HMR + Vite proxy to prod API) on VPS 3:

    cd /opt/tacticalrmm-fork/dev-server   # current canonical location
    docker compose up -d --build

The container mounts `/opt/tacticalrmm-fork/tacticalrmm-web` as `/app` and
binds the host's port `9000`. The Cloudflare tunnel on VPS 3 routes
`https://rmm-dev.bhsj.org` to `http://10.104.8.67:9000`. The dev server
proxies all backend paths to `https://rmm-api.bhsj.org` so the SPA stays
same-origin (no CORS fight) and we never have to touch the prod nginx
container.

This folder is the version-controlled copy of the dev-server scaffold;
the running copy at `/opt/tacticalrmm-fork/dev-server/` is unversioned
intentionally so the dev container's compose file can keep paths absolute.
