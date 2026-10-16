#!/usr/bin/env bash
# Deploys Walk We with AI on, to Cloudflare Workers (account subdomain: walkwe):
#   1. the AI proxy (apps/ai-proxy)  -> https://walkwe-ai-proxy.walkwe.workers.dev
#   2. the web app (apps/web, static) -> https://walkwe-web.walkwe.workers.dev
#
# One-time setup, done by you (your accounts, your key):
#   npx wrangler login
#   cd apps/ai-proxy && npx wrangler secret put ANTHROPIC_API_KEY
#   cd apps/ai-proxy && npx wrangler secret put ELEVENLABS_API_KEY   # optional: natural voice for Read aloud
# The proxy only answers the web app's origin (ALLOWED_ORIGINS in apps/ai-proxy/wrangler.toml).
#
# Then:  bash scripts/deploy.sh
set -euo pipefail
cd "$(dirname "$0")/.."

PROXY_URL="https://walkwe-ai-proxy.walkwe.workers.dev"
WEB_URL="https://walkwe-web.walkwe.workers.dev"
WRANGLER="$PWD/node_modules/.bin/wrangler"

echo "== 1/3 AI proxy =="
(cd apps/ai-proxy && "$WRANGLER" deploy)

echo "== 2/3 Build the web app with AI on =="
VITE_AI_PROXY_URL="$PROXY_URL" npm run build

echo "== 3/3 Web app =="
(cd apps/web && "$WRANGLER" deploy)

echo
echo "Done. Open ${WEB_URL}"
