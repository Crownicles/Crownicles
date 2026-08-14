# Crownicles mobile app

Expo (React Native) client for Crownicles. It talks to the **RestWs** service:
REST for authentication and asset downloads, WebSocket for gameplay packets.

Packet definitions are shared with the backend through the `WsPackets` package,
linked from the repository (`link:../WsPackets`).

## Setup

1. Install the dependencies of `WsPackets` then of the app:

   ```bash
   cd ../WsPackets && pnpm i
   cd ../App && pnpm i
   ```

2. Create your local environment file:

   ```bash
   cp .env.example .env
   ```

   `.env` is gitignored because the URLs depend on your setup. `localhost` works
   for the web build and the simulators; on a physical device, replace it with the
   LAN IP of the machine running RestWs.

3. Start the **RestWs** service, and the **Core** service it relies on.

4. Start the app:

   ```bash
   pnpm start
   ```

   Then open it in a [development build](https://docs.expo.dev/develop/development-builds/introduction/),
   an [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/),
   an [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/) or
   [Expo Go](https://expo.dev/go).

## Project layout

- `app/` — screens, using [file-based routing](https://docs.expo.dev/router/introduction)
- `src/networking/` — REST client and WebSocket client
- `src/authentication/` — Keycloak token handling
- `src/translations/` — i18n, fed at runtime by the assets downloaded from RestWs
- `metro.config.js` — makes Metro watch and resolve the linked `WsPackets` package
