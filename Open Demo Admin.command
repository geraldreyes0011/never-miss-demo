#!/bin/bash
# Double-click to open the demo admin on this computer (no sign-in needed).
# It uses this Mac's GitHub login (GitHub CLI) and publishes changes to the live site.
cd "$(dirname "$0")" || exit 1
echo "Getting the latest version…"
git pull --ff-only --quiet || echo "(Couldn't update from GitHub; continuing with this copy.)"
[ -d node_modules ] || npm install
echo "Opening the admin in your browser. Keep this window open while you edit; close it when you're done."
npm run --silent admin
