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

2. Create your local environment file for the web build or simulators:

   ```bash
   cp .env.example .env
   ```

   `.env` is gitignored because the URLs depend on your setup. `localhost` works for the web
   build and the simulators. Do not use this file as the physical-device launcher: the mobile
   scripts inject the same URLs into Metro and the app bundle at launch.

   The physical-device default is the stable mDNS name of the Mac, not its current IP address:

   ```bash
   echo "http://$(scutil --get LocalHostName).local:10500"   # macOS
   echo "http://$(hostname).local:10500"                     # Linux with avahi, Windows with Bonjour
   ```

   A name keeps working when the Mac moves between Wi-Fi networks or an iPhone hotspot. The
   Android USB mode uses `adb reverse` instead of relying on Wi-Fi or mDNS.

3. Set up the Discord identity provider in Keycloak, as described in
   [the Keycloak README](../keycloak/README.md). The app signs in through Keycloak
   only, so no Discord credential is ever configured in this project.

   Keycloak brokers the login, so the URL to declare in the Discord developer portal is
   the one of its broker endpoint, **not** an app or a RestWs URL:

   ```
   http://<keycloak-host>:8080/realms/Crownicles/broker/discord/endpoint
   ```

   In that portal, the **Save Changes** button only appears once the field loses focus.

   Keycloak also freezes the host it advertises when it starts: run it with the same
   `KEYCLOAK_HOSTNAME`, otherwise it keeps redirecting to the previous one and the login
   fails with an invalid URI. Check what it currently advertises with:

   ```bash
   curl -s http://<keycloak-host>:8080/realms/Crownicles/.well-known/openid-configuration
   ```

4. Start the **RestWs** service, and the **Core** service it relies on.

5. Start the app:

   ```bash
   pnpm start
   ```

   Then open it in a [development build](https://docs.expo.dev/develop/development-builds/introduction/),
   an [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/),
   an [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/) or
   [Expo Go](https://expo.dev/go).

   For a physical iPhone on Wi-Fi or USB tethering, use:

   ```bash
   pnpm start:iphone
   ```

   This starts Expo Go in tunnel mode and derives the Mac hostname at launch. It also injects the
   REST, WebSocket and Keycloak URLs into the same Metro process, so the app cannot load a bundle
   with missing `EXPO_PUBLIC_*` values. Core, RestWs, MQTT and Keycloak must already be running.

   Expo Go is the intended client for this quick physical-device preview; no native iOS build or
   CocoaPods installation is required for this path.

   Once a development build is installed on the iPhone, start its Metro bundle with:

   ```bash
   pnpm start:iphone:dev
   ```

   The explicit USB alias is also available:

   ```bash
   pnpm start:iphone:usb:dev
   ```

   Scan the QR code or open the `exp+crownicles://...` link shown by this command. Opening the
   development-build icon by itself does not select a Metro server.

   For Android on Wi-Fi:

   ```bash
   pnpm start:android:dev
   ```

   For Android over USB, with USB debugging enabled and the device authorized:

   ```bash
   pnpm start:android:usb:dev
   ```

   The USB command runs `adb reverse` for Keycloak, REST and WebSocket ports. It is the only
   platform-specific networking step; iOS USB requires Personal Hotspot or USB tethering because
   iOS has no equivalent reverse-port command for an arbitrary development server.

## The native projects are generated, not stored

`ios/` and `android/` are absent from the repository: `npx expo prebuild` rebuilds them from
`app.json`, and `npx expo run:ios` or `run:android` does it on its own when they are missing.
Anything edited by hand in there is lost on the next generation, so a native change belongs in a
config plugin declared in `app.json`.

Only a change to the native dependencies or to `app.json` calls for a new build. Everything written
in TypeScript is served by Metro and reloads on the fly.

**Unlock the device before running `expo run:ios` on a phone.** A locked device makes the command
stop on a confirmation prompt that the progress spinner draws over, so it looks like a build that
never finishes when it is in fact waiting for an answer.

## Project layout

- `app/` — screens, using [file-based routing](https://docs.expo.dev/router/introduction)
- `src/networking/` — REST client and WebSocket client
- `src/authentication/` — Keycloak login (Authorization Code + PKCE) and token handling
- `src/translations/` — i18n, fed at runtime by the assets downloaded from RestWs
- `metro.config.js` — makes Metro watch and resolve the linked `WsPackets` package

## Before writing code

Read [the contribution guide](../.github/instructions/app.instructions.md): service boundaries, how
to expose a command or a collector family, and the pitfalls already paid for. `mockups/mobile.html`
holds the target screens and `mockups/architecture.html` the diagrams.
