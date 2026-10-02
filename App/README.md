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

## Game Center and Google Play Games

These are optional cosmetic services, not Crownicles login providers. Achievements belong to the
device's Game Center or Play Games profile, independently of Keycloak and of the character being
played. Changing or deleting a Crownicles account does not reset them. Apple and Google remain
separate profiles; this integration does not transfer achievements between the two ecosystems.

The app decides and stores achievement conditions locally. The first achievement unlocks after a
finished PvP fight, including a defeat or a draw; monster fights and refused/interrupted fights do
not unlock it. Nothing is granted by Core and no in-game reward depends on the SDK's result.

The leaderboard keeps the highest **weekly score observed by the app**, across weeks and
Crownicles accounts, without adding different characters' scores together. It reads the current
player's own weekly score from the existing `TopReq`/`TopRes` contract at login, on relevant game
cache invalidations and once a minute while foregrounded. This is not a historical server record:
a week entirely played outside the app cannot be recovered after its reset. Scores are submitted
by the client; this is not an anti-cheat guarantee for a competitive reward system.

Progress is saved before submitting to the platform. Failed submissions are retried on reconnect,
foregrounding, new progress or the retry action in Settings. Storage and pending submissions are
isolated by platform player ID, never by Crownicles account. Progress earned before platform login
is adopted by the first profile that connects on that device. Reinstalling the app removes unsent
local progress; achievements already accepted by Apple/Google remain on that platform profile.

### Create the first resources

| Resource | Configuration |
| --- | --- |
| Achievement | `Premier duel`, standard/non-incremental, visible, non-repeatable, 10 points |
| Locked description | `Terminer un combat contre un autre joueur.` |
| Unlocked description | `Un combat contre un autre joueur a ete termine.` |
| Leaderboard | `Record topweek`, integer points, highest score first, keep the best score, permanent/all-time |

In App Store Connect, enable Game Center for `com.crownicles.app`, then create:

- Achievement ID: `com.crownicles.app.pvp_fight_completed`.
- Classic leaderboard ID: `com.crownicles.app.topweek_best`. Do not use a recurring weekly
   leaderboard: the value represents a player's best week, not the current week's score.
- French metadata and artwork required by the console. Add the achievement/leaderboard to the
   app version before submitting that version. Enable the capability for the App ID and regenerate
   its provisioning profile; the app entitlement is already declared.

In Play Console, create/link Play Games Services to the app's Google Cloud project, then:

- Link the Android package `com.crownicles.app` to the appropriate OAuth credentials. Register
   the **Play app-signing** SHA-1 for store builds, and the debug/local-release SHA-1 for local builds.
   The upload certificate is not the certificate Google uses to sign installed store builds.
- Create the standard achievement and a descending integer leaderboard using the table above.
- Copy the numeric project APP_ID and the generated achievement/leaderboard IDs to the public
   variables listed in `.env.example`. They are not secrets; no server OAuth credential is needed.
- Add the device's Google account to the Play Games test list (or enable the internal-test track).
   Publish the Play Games configuration before making a production app version available.

Game Center is disabled by default. Set `EXPO_PUBLIC_GAME_CENTER_MODE=production` only for a build
that uses the real services and real game data. Its identifiers have defaults in `app.config.js`; Google identifiers must come
from Play Console and cannot be invented. Restart Metro after changing configuration. Run
`pnpm exec expo prebuild` and rebuild the native app when the APP_ID or a native dependency changes.
No EAS account is needed. Old native clients and Expo Go show an unavailable state instead of
pretending an achievement was submitted. Web does not initialize either SDK.

### Test on a device

1. Use a newly rebuilt native app and a platform account authorized for testing.
2. Open Settings and connect the platform profile if it is not already connected.
3. Finish a PvP fight in the app. Open Settings > Achievements and verify `Premier duel` is earned.
4. Read the topweek, then open its native record leaderboard. Resetting the week or changing to
    a character with a lower weekly score must not reduce that record.
5. Repeat the fight, restart the app and change Crownicles accounts: the achievement stays earned.
    Use a different platform profile to verify pending submissions do not migrate to another person.

The Android dependency is patched in `patches/` to use `unlockImmediate` and `submitScoreImmediate`:
the local outbox is acknowledged only after Google responds, not when the wrapper schedules a call.

### Local GameKit on iPhone

This profile tests the native SDK before publication without sending scores to public resources.
It requires Xcode 16.3 or newer and a physical iPhone running iOS 18.4 or newer.

```sh
pnpm gamekit:prepare
pnpm gamekit:metro
```

The GameKit launcher reuses `scripts/start-mobile.sh`: REST, WebSocket and Keycloak target the local
Mac hostname by default, not the NAS alpha deployment. Start Core and RestWs on the Mac first;
MariaDB, MQTT and Keycloak must also be available locally. Explicit endpoint overrides use the same
`CROWNICLES_REST_API_URL`, `CROWNICLES_WEBSOCKET_URL` and `CROWNICLES_KEYCLOAK_URL` variables as the
normal mobile launcher. Use `pnpm gamekit:metro --dry-run` to check the resolved URLs.

The preparation regenerates iOS, installs CocoaPods, copies the tracked catalog from
`game-services/CrowniclesLocal.gamekit` and creates the shared `CrowniclesGameKitLocal` scheme.
The local scheme enables GameKit Debug Mode, has no archive action and sets the native launch
marker. The normal `Crownicles` scheme is unchanged. The source-build workaround already required
by this project's React Native development client is preserved by the local plugin.

Open `ios/Crownicles.xcworkspace` in Xcode, select **CrowniclesGameKitLocal** and the physical iPhone,
then use **Product > Run**. Running the normal scheme, launching the app icon or using
`expo run:ios` alone does not activate this local GameKit session. The developer client may ask for
the Metro URL; use the LAN address displayed by `pnpm gamekit:metro` on port 8084.

Open **Debug > GameKit > Manage Game Progress** in Xcode and select the device and app. The catalog
contains `com.crownicles.app.local.pvp_fight_completed` and
`com.crownicles.app.local.topweek_best`, never the public IDs. In the app, Settings shows
**Profil de test local**; connect Game Center there if needed, then finish a PvP fight and inspect
the progress in Xcode. Also verify the topweek record and the native achievements/leaderboard views.
Do not manually set the achievement to 100% when checking the fight trigger.

The native launch marker is authoritative: even stale Metro metadata cannot choose public resource
IDs in this profile. Local progress uses a separate storage namespace; legacy unscoped data is not
adopted into either local or production iPhone progress. The local SDK patch exposes this marker
as an Expo native property. Android's current profile is unchanged.

To repeat an achievement test, reset its progress in Game Progress Manager, then use
**Effacer le suivi local de test** in the app's Settings before finishing another fight. Resetting
only Xcode progress leaves the app's acknowledgement in place. A new topweek read can restore the
current weekly score after a reset; this is expected and never alters the production namespace.

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

## Visual source of truth

`mockups/mobile.html` is the visual source of truth for the mobile client: layout, colours,
spacing, typography and the five-tab bottom navigation are kept there first. React Native screens
reuse the matching tokens and primitives from `src/design/` instead of introducing screen-local
hex colours, font sizes or spacing values. The app loads the same Inter family used by the mockup
through `src/design/Fonts.ts`.

## Emoji assets

The app renders Unicode emoji with [jdecked Twemoji 17.0.3](https://github.com/jdecked/twemoji),
the same artwork family used by Discord and by `mockups/mobile.html`. The graphics are licensed
under [CC-BY 4.0](https://creativecommons.org/licenses/by/4.0/); this attribution covers the
Twemoji assets loaded by `src/design/TwemojiIcon.tsx`.

When a reusable pattern is missing, add it to `src/design/` and use it from at least one screen
before creating a second local variant. Keep route files focused on data and interaction; styles
shared by several screens do not belong beside a route because Expo Router treats every file in
`app/` as a possible route.

## Before writing code

Read [the contribution guide](../.github/instructions/app.instructions.md): service boundaries, how
to expose a command or a collector family, and the pitfalls already paid for. `mockups/mobile.html`
holds the target screens and `mockups/architecture.html` the diagrams.
