#!/usr/bin/env bash
# Deploy helper for Surge (free static hosting, no custom domain needed).
#
#   ./deploy-surge.sh your-subdomain.surge.sh
#
# Surge hosts at the domain root, so this builds with VITE_BASE_PATH=/ (it
# overrides .env.production). Surge reads dist/200.html as the SPA fallback
# automatically. Before the first deploy run: npm i -g surge && surge login
set -euo pipefail
target="${1:?Usage: ./deploy-surge.sh your-subdomain.surge.sh}"
command -v surge >/dev/null || npm i -g surge
VITE_BASE_PATH=/ npm run build
surge dist "$target" --domain "$target"
