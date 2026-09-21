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

## Sending mail

Opening the Crownicles account ([#4768](https://github.com/Crownicles/Crownicles/issues/4768)) makes
SMTP a production dependency: without it there is neither address verification nor password reset,
so nobody can finish signing up.

The realm ships **Brevo** on its free tier: **300 mails a day**, no card, no expiry, and an SMTP
relay included. It was picked over Mailjet (200/day), SMTP2GO (1 000/month), Resend (3 000/month),
MailerSend and Scaleway (both ask for a card). Fastmail was ruled out on purpose — its terms forbid
transactional mail and allow immediate suspension.

Three values in `smtpServer` are environment specific and are left as placeholders:

| Placeholder | Where to find it |
| --- | --- |
| `TO_REPLACE_WITH_YOUR_BREVO_SMTP_LOGIN` | the *SMTP & API* page — either the account address or `<id>@smtp-brevo.com` |
| `TO_REPLACE_WITH_YOUR_BREVO_SMTP_KEY` | an **SMTP key** generated on that same page |
| `TO_REPLACE_WITH_YOUR_SENDER_ADDRESS` | the sender, on a domain authenticated at Brevo |

Set them in *Realm settings → Email*, never in the versioned file. Watch out for two traps:

- the password is an **SMTP key**, not an API key — the two look alike and only one authenticates the
  relay;
- a Brevo account must be **approved for sending** before the first mail leaves, and approval is
  manual. Do it well before opening registration, not on launch day.

Brevo **blocks** at the daily quota, it does not overflow into paid usage. The app has to cope with a
mail that will not arrive, and an alert on the daily count gives the warning needed to switch relays
by hand — Scaleway Transactional Email being the fallback, at €0.25 per 1 000 after the first 300.
