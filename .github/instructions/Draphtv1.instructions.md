---
applyTo: '**'
---
# Crownicles Development Guide

## Architecture Overview

Crownicles is a **microservices-based Discord text adventure game** with these core services:
- **Core**: Game logic engine (TypeScript/Node.js + MariaDB + MQTT)
- **Discord**: Discord bot frontend (Discord.js + MQTT client)
- **RestWs**: Web/REST API service (Fastify + WebSocket + protobuf + Keycloak auth)
- **Lib**: Shared utilities and packet definitions across services

Services communicate via **MQTT message broker** using a packet-based protocol defined in `Lib/src/packets/`.

## Critical Development Workflows

### Quick Setup
```bash
# Use the automated setup script (Linux/macOS only)
./launchScripts/firstConfig.sh

# Or manual setup:
cd Lib && pnpm i
cd ../Core && pnpm i  
cd ../Discord && pnpm i
cd ../RestWs && pnpm i
```

### Running Services
```bash
# Core service (game engine)
cd Core && pnpm start

# Discord service (bot frontend)  
cd Discord && pnpm start

# RestWs service (web API)
cd RestWs && pnpm start
```

### Testing & Code Quality
- Tests: `pnpm test` (Vitest framework)
- Coverage: `pnpm test:coverage`
- Linting: `pnpm eslint` / `pnpm eslintFix`
- Build: `pnpm tsc` (outputs to `dist/`)

## Service Communication Patterns

### MQTT Packet System
Services use **strongly-typed packets** for communication:
```typescript
// Example packet handler in Discord service
@packetHandler(CommandTopPacketResScore)
async topScoreRes(context: PacketContext, packet: CommandTopPacketResScore): Promise<void> {
    await handleCommandTopPacketResScore(context, packet);
}
```

**Key patterns:**
- Core publishes to topics like `{prefix}/discord/{shardId}` or `{prefix}/websocket`
- Discord/RestWs subscribe to their respective topics
- Packet validation enforced at build time via `Lib/src/index.ts`
- Context includes platform info (Discord channel/user OR WebSocket connection)

### Database Integration
- **Sequelize ORM** with MariaDB
- Models in `{service}/src/database/models/`
- Migrations via `Umzug` in Lib
- Connection configs in `config/*.toml` files

## Project-Specific Conventions

### File Organization
```
{Service}/src/
  commands/           # User-facing command handlers
  packetHandlers/     # MQTT packet processors  
  database/models/    # Sequelize models
  {service}Constants.ts # Service-specific constants
```

### Packet Handler Registration
- Auto-discovered from `dist/{Service}/src/packetHandlers/handlers/**/*.js`
- Use `@packetHandler(PacketClass)` decorator
- Must implement interface from `Lib/src/packets/PacketListener.ts`

### Configuration Management
- TOML files in `{service}/config/`
- `config.default.toml` for templates, `config.toml` for local overrides
- Environment-specific configs: prefix, database, MQTT broker settings

### Internationalization
- Translation files in `Lang/{locale}/` (JSON format)
- Discord service generates types: `pnpm interface` creates `src/@types/resources.d.ts`
- Use `i18n.t("namespace:key", { lng })` pattern
- NEVER edit something else than the french translations, other languages are synced from there in crowdin, so any change will be overwritten.

### Docker Development
- Each service has a `Dockerfile`
- Keycloak setup in `keycloak/docker-compose.yml`
- Scripts use `dockerStart` npm command (runs pre-built `dist/` code)

## Common Integration Points

### Adding New Commands
1. Create packet definitions in `Lib/src/packets/commands/`
2. Add Core handler in `Core/src/commands/`
3. Add frontend handler in `Discord/src/packetHandlers/handlers/commands/`
4. Update packet validation in `Lib/src/index.ts`

### Authentication Flow
- RestWs uses Keycloak with `token-exchange` feature
- Discord OAuth integration via Keycloak client with `impersonation` role
- JWT tokens for WebSocket connections

### Monitoring & Logging
- Prometheus metrics via `prom-client` (`CrowniclesCoreMetrics`, `CrowniclesDiscordMetrics`)
- Winston logging with `winston-daily-rotate-file` and optional Loki integration
- Log levels configurable per service in TOML config

Always check `{service}/package.json` scripts and `launchScripts/*.run.xml` files for WebStorm run configurations.
