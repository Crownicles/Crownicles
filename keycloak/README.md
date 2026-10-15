# Keycloak

Keycloak is the project used to authenticate users on Crownicles
## Setup the folder

Create the necessary folder for Keycloak data:
```sh
mkdir -p PROJECT_ROOT/keycloak/data/h2
```
### Linux 🐧  
You may need to adjust folder permissions to allow Keycloak to read and write the data:
```sh
chmod -R 755 PROJECT_ROOT/keycloak/data/h2 # May require sudo
```
If you still encounter permission issues, try:
```sh 
chmod -R 775 PROJECT_ROOT/keycloak/data/h2  # Less restrictive
```
## Start with docker

Before starting, **make sure** you are in the folder `src/keycloak/`.  

You can start Keycloak with docker using the following command:

```bash
docker-compose up -d
```

You can find the docker-compose file here:
[docker-compose.yml](./docker-compose.yml)

The image is built from [Dockerfile](./Dockerfile). It adds the
[Phase Two magic link extension](https://github.com/p2-inc/keycloak-magic-link) (Elastic License 2.0)
and compiles the Crownicles `account-policy` extension. The browser, post-broker, registration and
forgotten-password flows use the account target guard, so an application-initiated email/password
action only ever runs on the account it was opened for; the registration flow also refuses reserved bot
usernames before creating a user. Every Keycloak importing the realm needs this image. After a change,
run `docker compose build keycloak`.

## Choosing the address Keycloak answers on

`KC_HOSTNAME` pins the address Keycloak puts in the tokens it issues and in the redirect URIs it
sends to the identity providers. Every client and service must therefore be able to reach Keycloak at
that exact address. For physical devices, use the stable mDNS hostname of the development Mac, not
the current Wi-Fi or hotspot IP. RestWs may still call Keycloak through `127.0.0.1` internally.

It defaults to `http://localhost:8080`, which is enough for the web build and the simulators. To let a
phone sign in, create your own file with the stable Mac hostname:

```bash
cp .env.example .env
```

and set `KEYCLOAK_HOSTNAME` to `http://<mac-name>.local:8080`. `.env` is gitignored because the
machine name depends on the developer, but it does not change when the Mac moves between networks.
After changing it, recreate Keycloak so the issuer is updated:

```bash
docker compose --env-file .env up -d --force-recreate keycloak
```

Note that the shipped realm has `sslRequired` set to `none`, because this whole setup serves plain
HTTP. Leaving the default `external` makes Keycloak reject requests as soon as it sees the client
address as public, which happens with some Docker networking setups even on a local machine. A real
deployment must raise it back and serve Keycloak over HTTPS.

## Configuring a realm

Visit http://127.0.0.1:8080/admin/master/console/ (Default credentials are admin/admin)

First click on the create realm button:

![create-realm.png](images/create-realm.png)

Import the already configured realm: [realm.json](realm.json):

![import-realm.png](images/import-realm.png)

Configure your Discord config.toml:

You will need to regenerate a client secret here on keycloak:

Manage -> Clients -> discord -> Credentials -> Client Secret -> Regenerate

![discord-config.png](images/discord-config.png)

### Keeping a deployed realm in line

A deployed realm is never replaced by [realm.json](realm.json), which holds placeholders instead of
users, keys and secrets. [realmDrift.mjs](scripts/realmDrift.mjs) compares only the account settings
the game relies on: the custom browser, registration, forgotten-password and post-broker flows with
their steps and configuration, their bindings, the Discord provider's post-broker flow, the event
listeners and the sign-up switches.

```bash
KEYCLOAK_URL=... KEYCLOAK_REALM=... KEYCLOAK_CLIENT_ID=... KEYCLOAK_CLIENT_SECRET=... \
  node keycloak/scripts/realmDrift.mjs           # read-only report, exit code 1 on a difference
node keycloak/scripts/realmDrift.mjs --apply     # same environment: converge, then report again
```

The service account needs the `realm-management` roles `view-realm`, `manage-realm`,
`view-identity-providers` and `manage-identity-providers`. Run the read-only check on every deployed
realm before and after a deployment, after the Keycloak image. `--apply` builds a differing flow beside
the running one, switches the bindings over, then deletes the old flow and takes back its names, so
sign-in never runs without its guard. A missing identity provider is only reported: its secrets are not
in the template.

## Logging in with Discord

The imported realm ships a `discord` identity provider, so Keycloak talks to Discord itself and the
front-ends only ever run a standard Authorization Code + PKCE flow against Keycloak. Adding another
way to sign in later is a matter of declaring one more provider here, with no change in the clients.

Two values are environment specific and are therefore left as placeholders in `realm.json`:

1. In *Identity providers -> Discord*, replace `TO_REPLACE_WITH_YOUR_DISCORD_CLIENT_ID` and
   `TO_REPLACE_WITH_YOUR_DISCORD_CLIENT_SECRET` with the credentials of your Discord application.
2. Copy the *Redirect URI* displayed on that same page and add it to the *Redirects* list of your
   application in the [Discord developer portal](https://discord.com/developers/applications). It is
   built from `KEYCLOAK_HOSTNAME`. Register the stable iOS/Wi-Fi/USB-tethering URI once:
   `http://<mac-name>.local:8080/realms/Crownicles/broker/discord/endpoint`.

   For Android USB mode, also register the loopback URI once because `adb reverse` exposes the Mac
   through the device's `127.0.0.1`:
   `http://127.0.0.1:8080/realms/Crownicles/broker/discord/endpoint`.

   These are two fixed development redirect URIs. Switching from home Wi-Fi to an iPhone hotspot
   does not require changing Discord, and the old IP-based fallback should be removed after the
   stable URI has been registered.

The provider uses the generic `oauth2` type because Discord is not an OpenID Connect provider: it
returns opaque tokens, so Keycloak reads the profile from `https://discord.com/api/users/@me`.

### Account matching

Accounts created by the Discord bot are named `discord-<discord id>`. The provider reproduces that
name through its *username* mapper, so a returning player is matched to the account that already
holds their progress instead of getting a second one. Changing the mapper template would cut
existing players from their progress.

The first login flow is the built-in `first broker login`. When the username already exists it asks
the player to confirm the link, then requires a proof of ownership through *Account verification
options*, which reads in priority order:

1. `idp-email-verification` — a mail is sent to the address already on the account;
2. *Verify Existing Account by Re-authentication* — **conditional**: `conditional-user-configured`
   skips it when the account carries no password to re-enter;
3. `idp-auto-link` — last resort.

The third step is what keeps the migration working. An account created by the bot has **neither an
address nor a password**: it has nothing to prove, and nothing an attacker could be given. Step 1
fails for lack of an address, step 2 is skipped for lack of a password, and the brokered identity is
attached. The Discord address then lands on the account through `emailClaim`, and from that point on
step 1 guards it.

Conversely an account that does carry credentials never reaches step 3, because a satisfied
conditional sub-flow is treated as required and takes precedence over the alternatives. This is what
closes the takeover path described in
[#4767](https://github.com/Crownicles/Crownicles/issues/4767): registering under someone else's
address no longer captures their Discord identity.

> The precedence of a satisfied `CONDITIONAL` sub-flow over its sibling `ALTERNATIVE` executions is
> the load-bearing assumption here. Replay both cases against a real Keycloak before deploying: a
> legacy `discord-<id>` account, and an account holding a password.

## Historical Discord Accounts and Email Collisions

The game owns progress by the Keycloak user ID, not by email. A bot-created user
named `discord-<id>` can have neither email nor federated identity. An unrelated
email registration can then win the first-broker-login email lookup before the
historical username is considered. Confirming ownership does not merge game data.

New bot accounts now include their Discord federated identity in the user creation
request. Existing accounts require an explicit backfill. Only users whose managed
`discordId` attribute matches their historical username are eligible. Existing
conflicting links are never removed or reassigned, and player rows are not updated.

This backfill only establishes the historical identity. It does not resolve a
collision by letting both accounts remain selectable. When the authenticated
Discord email is already owned by a distinct Crownicles account, the app stops
before opening the game. The address answers for both accounts, as Discord itself lets
it recover the Discord account; a Discord session never answers for the address. So,
signed in with Discord, the player must also sign in to the email account, while signed
in with the address, they may keep that account at once (keeping the Discord account
signs in to it first). The player confirms removal of the other Keycloak user.
The losing account's game data stays retained under the existing deletion policy;
no progress, items or currencies are merged into the kept character.

Discord email and its verified flag are managed IdP attributes, not editable user
fields. The current provider is exposed through a session-note protocol mapper.
The resolver rechecks both accounts before deletion, persists the confirmed choice
on the kept identity and can resume it after an interruption. HTTP requests cannot
provide an arbitrary account ID to delete. The discarded WebSocket is closed and
unresolved collisions cannot open a game WebSocket. The collision routes, reached before
the WebSocket, refuse an app speaking another protocol version with HTTP 426, as the
WebSocket does.

Resolution is serialized in the RestWs process. Run one resolving RestWs instance;
multi-instance resolution needs a shared coordinator before horizontal scaling.
Do not run other administrative reassignment operations concurrently. Every service
change to a Keycloak account goes through `KeycloakUtils.patchUser`, which reads the
account again right before writing it back whole (the admin API takes nothing less): a
change made meanwhile by the bot, a language switch or a resolution is no longer erased
by a stale copy. Only the instant between that read and the write stays unguarded, as
Keycloak offers no conditional update.

Keeping both accounts is a separate, intentional path: from the collision screen, the
player changes and verifies the email account address before entering the game. The
change is targeted at that account's Keycloak ID; a different authenticated account is
refused before the required action can run.

The resolver accepts both access tokens in one request, or the email account's own session
alone when it keeps itself. It writes a durable choice on
the kept account before deleting the other identity, so a lost response or crash resumes
the same choice.

Unconfirmed form registrations are marked `registrationPending` by the registration
policy. The `crownicles-registration-confirmation` listener removes only that attribute
when Keycloak confirms the email or signs in its verified owner, within Keycloak's own
transaction. RestWs reads all pending pages before deleting only those still unverified
and older than one hour; it never rewrites confirmed profiles, and historical bot
accounts are never selected by that search.

The Discord provider uses `IMPORT`, not `FORCE`: forcing the remote email onto an
already-linked historical user fails when another user owns that address. Instead, the
`crownicles-discord-email` step of the post-broker flow gives an account without any address
the one Discord verified, when no other account holds it: that address can then sign in to
the account by link, and sign-up refuses it. A taken address is left as it is, for the
collision flow to settle. The
`gameUsername` mapper is `IMPORT`, so a missing Discord display name never erases it. `VERIFY_PROFILE` is explicitly disabled to
avoid retroactive email requirements on historical accounts. Email remains required
by the registration profile and `verifyEmail` stays enabled.

Deployment order:

1. Back up the realm and user data. Put login, registration and bot account creation
  into maintenance so identity ownership cannot change during the operation.
2. Apply the targeted provider and required-action changes to the deployed realm.
  Do not replace the live realm with this template: it contains placeholders and
  does not contain live users, keys or service-client configuration.
  Build/deploy the image before switching the browser and registration flows to the
  Crownicles extension executions. Set Discord's `postBrokerLoginFlowAlias` to
  `crownicles post broker login` as well: a brokered login skips the remainder of the
  browser flow. Enable the `crownicles-registration-confirmation` event listener.
  `node keycloak/scripts/realmDrift.mjs --apply` does all of this once the image runs
  (see [Keeping a deployed realm in line](#keeping-a-deployed-realm-in-line)).
3. Compile Lib with `pnpm --dir Lib run tsc`. Provide `KEYCLOAK_URL`,
  `KEYCLOAK_REALM`, `KEYCLOAK_CLIENT_ID` and `KEYCLOAK_CLIENT_SECRET` through the
  operator's environment, using a service account with query/view/manage-users.
4. Run `node keycloak/scripts/linkLegacyDiscordAccounts.mjs` for a read-only audit.
  Resolve every conflict manually before applying. Never use email alone as proof
  that two game accounts should be merged.
5. Run the same command with `--apply`, then repeat the read-only audit. Conflicts
  produce a nonzero exit code; repeated successful links are no-ops.
6. Test a historical player and a distinct email account before leaving maintenance.

The reproducible laboratory test is `bash keycloak/tests/run-integration.sh`, which the
[Keycloak integration](../.github/workflows/keycloak-integration.yml) workflow also runs. It needs
Docker and the Lib, RestWs and App dependencies (App only lends its DOM/cookie parsers), compiles Lib
and RestWs, builds this image, and runs
[discord-identity.integration.test.mjs](tests/discord-identity.integration.test.mjs) against a
disposable Keycloak on `127.0.0.1:18180` with the synthetic bootstrap account
`proof-admin` / `local-proof-only-password`, plus a mail catcher on ports 18025/11025 (an existing one
is reused). The test only recreates the dedicated `crownicles-discord-identity-proof` realm and uses a
synthetic OAuth provider on port 18181; it must not run against a shared or deployed Keycloak. It
proves the broker/token identity, conflict refusal, backfill behavior, both choices with real PKCE
tokens, losing-identity deletion, subsequent Discord login, registration email constraints, the
account guard on every way into an application-initiated action (sign-in, Discord, sign-up,
forgotten password) and the realm drift check; not a live Discord consent screen.

## Sending mail

Opening the Crownicles account ([#4768](https://github.com/Crownicles/Crownicles/issues/4768)) makes
SMTP a production dependency: without it there is neither address verification nor password reset,
so nobody can finish signing up.

The realm ships **Brevo** on its free tier: **300 mails a day**, no card, no expiry, and an SMTP
relay included. It was picked over Mailjet (200/day), SMTP2GO (1 000/month), Resend (3 000/month),
MailerSend and Scaleway (both ask for a card). Fastmail was ruled out on purpose — its terms forbid
transactional mail and allow immediate suspension.

The sender is `contact@crownicles.com`, on the `crownicles.com` domain authenticated at Brevo, so
SPF and DKIM are signed and the verification mails are not treated as spam. It is already set in
`realm.json`. Two values remain environment specific and are left as placeholders:

| Placeholder | Where to find it |
| --- | --- |
| `TO_REPLACE_WITH_YOUR_BREVO_SMTP_LOGIN` | the *SMTP & API* page — either the account address or `<id>@smtp-brevo.com` |
| `TO_REPLACE_WITH_YOUR_BREVO_SMTP_KEY` | an **SMTP key** generated on that same page |

Set them in *Realm settings → Email*, never in the versioned file. Watch out for three traps:

- the password is an **SMTP key**, not an API key — the two look alike and only one authenticates the
  relay;
- the account filters on **[authorised IPs](https://app.brevo.com/security/authorised_ips)**. Every
  machine that sends — a developer laptop as much as the production host — has to be listed there,
  otherwise Brevo answers `401 unauthorized` with an `unrecognised IP address` message and no mail
  leaves. Home connections usually have a rotating address, so expect to add it again;
- a Brevo account must be **approved for sending** before the first mail leaves, and approval is
  manual. Do it well before opening registration, not on launch day.

Brevo **blocks** at the daily quota, it does not overflow into paid usage. The app has to cope with a
mail that will not arrive, and an alert on the daily count gives the warning needed to switch relays
by hand — Scaleway Transactional Email being the fallback, at €0.25 per 1 000 after the first 300.

## Looking like the game

The player leaves the app to sign in, so the pages and the mails they land on are part of the game's
surface, not a separate website. The realm points `loginTheme` and `emailTheme` at **`crownicles`**,
a theme living in `keycloak/theme` and mounted into the container as a single theme — mounting over
`/opt/keycloak/themes` would hide the built-in ones it inherits from.

It carries a single template of its own. `login` inherits from `keycloak` and adds one stylesheet that
restates the tokens of `App/src/design/Theme.ts`: white paper, ink text, pill buttons, no relief.
It overrides `login-verify-email.ftl` only: the mail link is usually opened in the mail app, so the
page resumes the sign-up when the player comes back to it (`js/crownicles.js`), and tells them where
it went on when the link was opened in another browser, which takes the flow over.
`email` inherits from `base` and replaces the layout and the wordings, in French and in English.

Three things to know before editing it:

- **PatternFly draws borders in `::before` and `::after` layers.** Overriding `border` on the element
  leaves a second, misaligned frame that no amount of specificity removes. The pseudo-elements have
  to be hidden.
- **Mail styling has to be inline.** Clients strip `<style>` blocks, so a stylesheet would leave the
  message unstyled exactly where it matters.
- **`start-dev` reloads the theme on every request, but the browser does not.** Keycloak serves its
  resources with a long `Cache-Control`, so a plain reload keeps the old CSS. Force it, or check what
  is actually served with `curl`.

Pages and mails follow the player's language: the realm declares the game's six locales and defaults
to French, and the app passes `ui_locales` on every authorisation request. Mails are the exception —
they are sent outside of any request, so Keycloak reads the user's `locale` attribute. Accounts
created by the Discord bot carry `language` instead, so their mails fall back to French until the
two are reconciled.

Inter is served by the theme itself, in `login/resources/fonts`. A remote stylesheet on a sign-in
page would hand a third party the address of every player who signs in, and would turn any
compromise of that host into arbitrary CSS on the page where passwords are typed — CSS is enough to
exfiltrate what is being typed, through attribute selectors and background images.

## Hardening

A few settings in `realm.json` are deliberate and easy to undo by accident:

- **`sslRequired` is `external`**, which is what production needs. Locally Keycloak sometimes sees a
  public client address — a VPN, or Docker's own NAT — and then answers `HTTPS required` to
  everything. The fix is to lower the *running* realm, never the file:
  `kcadm.sh update realms/Crownicles -s sslRequired=NONE`.
- **Sign-up is Keycloak's own page, with `verifyEmail` on.** The app opens it with `prompt=create`.
  It asks for a username and an address only. The emailed link confirms ownership and signs the
  player in; a password remains optional and can be configured later from settings.
- **Registration validation happens before account creation.** The `crownicles-registration-policy`
  form action refuses reserved usernames, initializes `gameUsername` with the player's case and
  marks the registration as pending. It does not apply to the bot's Admin API creation path.
  `PendingRegistrations` only releases expired unverified registrations through a paginated
  attribute search; it no longer repairs users from a bounded list of `REGISTER` events.
- **Unmanaged attributes are `ADMIN_EDIT`.** `discordId`, `gameUsername` and `language` are not
  declared in the user profile, so only the Admin API writes them. Under `ENABLED` a player could
  set their own `discordId` — from the account console, or by adding a field to the sign-up
  form — and be taken for another player by the bot. ⚠️ Importing `realm.json` resets the policy
  to `ENABLED`: the file declares Keycloak 22, and the migration to 24 enables unmanaged attributes
  to preserve the behaviour of the time. Set it back after every import, in *Realm settings → User
  profile → Unmanaged attributes*.
- **The account console is off.** The `account-console` client is disabled and the default roles
  no longer grant `manage-account` nor `view-profile`. The app covers what it offered: the account
  deletion goes through RestWs, and a forgotten password through the sign-in page.
- **Attribute updates send the whole account back.** A partial `PUT` on a user makes Keycloak erase
  what it omits, the address included, which locks a player out of their password reset.
- **`passwordPolicy` requires 10 characters** and refuses the username or the address as a password.
  Without it any password is accepted, including a single letter, which matters as soon as accounts
  are not brokered any more.
- **`failureFactor` is 10**, down from the Keycloak default of 30.
- **No client accepts direct access grants.** The password grant is gone from OAuth 2.1, and it was
  only ever used by two RestWs routes, `/login` and `/refreshToken`, that the app never called — it
  talks to Keycloak directly with PKCE. Both routes are removed, along with `KeycloakUtils.loginUser`
  and `refreshUserToken`. The admin API keeps working: it was already using `client_credentials`
  through the service accounts of `discord` and `restWs`.
- **`crownicles-app` only accepts its own redirect URI.** A custom scheme is not exclusive — another
  application can register `crownicles://` and catch the code — so the wildcard was narrowed to the
  `auth` path. PKCE already makes a stolen code useless, but there is no reason to hand it out.
- **The image is pinned** to an exact version. An authentication server on `latest` upgrades
  silently, and nothing tells which advisories apply to what is actually running.

Two traps met while upgrading:

- **Commands other than `start` refuse to migrate the schema.** `export` fails with `Database not
  up-to-date` after an image bump; start the server once, then export.
- **`registration-profile-action` no longer exists** since the declarative User Profile replaced it.
  A realm still declaring it breaks registration with a `NullPointerException`, and the flow becomes
  unreadable through the API — `GET authentication/flows/registration/executions` answers 404 while
  the same call works for `browser`. Only a re-import fixes it.


