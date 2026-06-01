---
name: running-services
description: How to compile, start, and verify Core and Discord services locally. Includes terminal CWD pitfalls and pre-commit checklist. Use this skill when you need to start or restart services for testing.
---

# Running Crownicles Services Locally

## Background Terminal CWD Pitfall
When using VS Code background terminals (`isBackground=true`), the **working directory is always the workspace root**, regardless of any `cd` command. The `cd` gets stripped from the command.

**Solution**: Use `pushd` to change directory before launching:
```bash
# Core
pushd /path/to/Crownicles/Core && node dist/Core/src/index.js; popd

# Discord
pushd /path/to/Crownicles/Discord && node dist/Discord/src/index.js; popd
```

## Compilation
Both services need to be compiled before running:
```bash
# In non-background terminal (where cd works)
cd Core && pnpm tsc
cd Discord && pnpm tsc
```

## Starting Services
```bash
# 1. Start Core (background terminal with pushd)
# Core takes ~20s to fully start (DB connections + packet handlers + tops update)

# 2. Start Discord (background terminal with pushd)
# Discord takes ~15s (shard login + MQTT connect)
```

## Build Output Paths
Both services compile to `dist/` inside their own directory:
- Core: `Core/dist/Core/src/index.js`
- Discord: `Discord/dist/Discord/src/index.js`

The `node dist/{Service}/src/index.js` path is **relative** — requires correct cwd.

## Verifying Services Are Running
Use `get_terminal_output` on the background terminal ID and look for:
- **Core**: `"Tops updated"` line at the end of startup
- **Discord**: `"Received global message"` lines when commands are processed
