#!/bin/zsh
set -euo pipefail

script_dir="$(cd "${0:h}" && pwd)"
exec zsh "$script_dir/start-mobile.sh" --android "$@"
