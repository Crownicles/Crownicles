---
applyTo: 'App/**,WsPackets/**,RestWs/**'
---
# Working on the Crownicles mobile app

Read this before touching `App/`, `WsPackets/` or `RestWs/`. It complements, and does not repeat,
`review-checklist.instructions.md`, which still applies in full.

## The one thing to understand first

**Core is the game.** It already exists, it is frontend-agnostic, and Discord has been consuming it
in production for years. The mobile app is a *second frontend*, never a second implementation.

Two consequences that decide most design questions:

- **No game rule lives in `App/`.** No balance value, no reward computation, no eligibility check. If
  a screen needs a number the server does not send, the fix is a packet field, not a constant.
- **No data shape is invented.** `Lib/src/packets/` already defines 53 command packets and 55
  collectors, with their exact fields and optionals. Copy that shape; never guess one.

## Who does what

| Service | Owns | Must never |
| --- | --- | --- |
| `Core` | Game rules, state, collectors, persistence | Know that a mobile app exists |
| `Lib` | Packets and types shared between Core and its frontends | Contain frontend code |
| `RestWs` | Authentication boundary, translation Lib <-> WsPackets, MQTT bridge | Contain game logic |
| `WsPackets` | The wire contract between the app and RestWs | Import from `Lib`, `Core` or `Discord` |
| `App` | Presentation, navigation, session | Compute anything the server decides |

`WsPackets` is deliberately standalone: it duplicates the few types it needs (`MainItem`,
`SupportItem`, ...) rather than importing `Lib`. That is what lets the wire format stay stable while
`Lib` evolves. Keep it that way — and register every duplicated enum in
`RestWs/__tests__/packets/WireEnums.test.ts`, because numeric enums are mutually assignable and a
member reordered in `Lib` would otherwise change the meaning of a value for installed clients
without a single compilation error.

## The interaction model is collectors, not screens

Roughly half the game is not "display data", it is: **the server proposes choices, the player picks
one by its index, the server answers**. A screen built as a passive view of data will be
structurally wrong.

The contract lives in `WsPackets/src/fromServer/collectors/`:

- `data` describes what is proposed, discriminated by `type`
- `reactions[]` lists the choices — **the order is the contract**, answering means sending an index
- `endTime` is an absolute timestamp, so the client can run a countdown without a shared clock
- an unmapped collector arrives under the `unknown` kind rather than being dropped, and **keeps its
  position** in the array

Answering is `ReactionCollectorReactReq { collectorId, reactionIndex }`. The player identity is
never carried by the packet: RestWs takes it from the authenticated connection.

## Recipe: expose a command over WebSocket

Core needs no change at all. Use `/drink` or `/profile` as a working model.

1. `WsPackets/src/fromClient/<Command>Req.ts` — the request, mirroring the fields of the `Lib` request
2. `WsPackets/src/fromServer/<command>/<Command>Res.ts` — the response, mirroring the `Lib` response
3. `RestWs/src/packets/fromClient/translators/<Command>ClientTranslator.ts` — `@fromClientTranslator`
4. `RestWs/src/packets/fromServer/translators/<Command>ServerTranslator.ts` — `@fromServerTranslator`

Watch out for:

- **A packet without a translator is not an exposed command.** `WsPackets` held drink packets for
  months while nothing referenced them, and they silently drifted away from the `Lib` ones. Grep the
  translators, not the packets, to know what a client can actually reach.
- **Error packets are packets too.** A command that can answer `PlayerNotFound` or `NoAvailablePotion`
  needs a translator for each of them, otherwise RestWs silently drops the answer and the app waits
  forever.
- A client asking about itself sends an empty `askedPlayer`; resolve it with `resolveAskedPlayer`.

## Recipe: add a collector family

1. `WsPackets/src/fromServer/collectors/families/<Family>.ts` — augment
   `ReactionCollectorDataPayloads` / `ReactionCollectorReactionPayloads` with `declare module`, and
   export the kinds as `as const satisfies Record<string, ReactionCollector*Kind>`
2. Add one `export *` line in `collectors/index.ts`
3. `RestWs/src/packets/fromServer/collectors/mappings/<Family>Mappings.ts` — declare the mapping with
   `defineReactionMapping` / `defineDataMapping`, passing the **Lib class itself**, not its name
4. Register the mappings in `ReactionCollectorMapper.ts`

Rules that make this safe, do not work around them:

- **Protocol kinds are decoupled from Lib class names.** A published app keeps working when the back
  end renames a class, and the rename breaks the compilation of the mapping file instead.
- **Always import collector types from `collectors/index.ts`.** A `declare module` augmentation only
  applies if its file belongs to the consumer's compilation unit; importing the base module directly
  gives a silently truncated union.
- A mapping may return `null` to decline a payload that does not fit its kind. Prefer that over
  casting a value into a shape it does not have.

## App rules

- **Every string goes through i18n** (`i18n.t`), every emoji through `AppIcons`. Both are downloaded
  at runtime from RestWs, so content ships without a store release.
- **Only French translations are edited** (`Lang/fr/`). Other languages come from Crowdin and any
  direct edit is overwritten.
- Screens must not call `WebSocketClient.getInstance()` directly. Go through the data layer, so a
  screen can be rendered and tested without a socket.
- `App/.env` is gitignored and machine-specific. On a physical device, use the LAN IP, not
  `localhost` — including in the Keycloak URL, since the login page opens on the device.

## Before opening a pull request

```bash
cd WsPackets && pnpm tsc && pnpm eslint
cd ../RestWs  && pnpm tsc && pnpm eslint && pnpm test
cd ../Lib     && pnpm tsc && pnpm eslint && pnpm test
cd ../App     && npx tsc --noEmit && pnpm lint
```

Never chain a linter into a pipe before `&&`: the shell reports the exit code of the pipe, not of the
linter, and broken lint gets committed.

## Verified pitfalls

- `makeFromServerPacket` uses `Object.assign`, so passing an explicitly `undefined` field **erases the
  class default**. Use a conditional spread instead of `field: maybeUndefined`.
- Core bounds-checks a reaction index but does not check that it is a whole number. Validate at the
  RestWs boundary, which is the only place that sees untrusted input.
- Translators are discovered by scanning `dist/`, so a translator that compiles may still not be
  registered. Starting RestWs and reading the `Registered` log lines is the only way to know.
- Packets are serialised twice, over MQTT then over the socket. Class instances arrive as plain
  objects; never rely on a prototype, a method or a getter surviving the trip.
- Core is reached through MQTT with a topic prefix: `RestWs/config/config.toml` and
  `Core/config/config.toml` must declare the **same** prefix, or no message ever crosses.

## For AI agents

- Do not add a field, a screen or a helper "for later". If nothing consumes it, it is dead code.
- Do not mock a data shape from imagination. Open the matching packet in `Lib/src/packets/` first.
- Do not declare a protocol change done before checking that the packet actually reaches the other
  side. Compiling and passing unit tests proves the contract, not the wiring.
- When an issue's scope conflicts with a tempting refactor in `Core` or `Lib`, keep the scope and
  report the refactor. A protocol pull request that rewrites item typing will not be reviewable.
