#!/bin/sh
# Runs a Job Hunter script with a Node.js new enough for it (22.18+, which runs
# TypeScript directly). The user's default `node` may be older, so look in the
# usual install places too. Usage: sh run.sh <script.ts> [args...]
# JOB_HUNTER_NODE=/path/to/node forces a specific binary.

ok() {
  [ -x "$1" ] && "$1" -e '
    const [maj, min] = process.versions.node.split(".").map(Number);
    process.exit(maj > 22 || (maj === 22 && min >= 18) ? 0 : 1);
  ' 2>/dev/null
}

for candidate in \
  "${JOB_HUNTER_NODE:-}" \
  "$(command -v node 2>/dev/null)" \
  /opt/homebrew/bin/node \
  /opt/homebrew/opt/node/bin/node \
  /usr/local/bin/node \
  "$HOME"/.volta/bin/node \
  $(ls -d "$HOME"/.nvm/versions/node/v*/bin/node 2>/dev/null | sort -rV) \
  $(ls -d "$HOME"/.local/share/fnm/node-versions/v*/installation/bin/node 2>/dev/null | sort -rV) \
  "/c/Program Files/nodejs/node.exe"
do
  if [ -n "$candidate" ] && ok "$candidate"; then
    exec "$candidate" "$@"
  fi
done

echo "Job Hunter needs Node.js 22.18 or newer, and none was found." >&2
echo "Install the LTS version from https://nodejs.org/ and try again." >&2
exit 3
