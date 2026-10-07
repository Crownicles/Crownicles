## ⚠️ This module is in development so the README is not written yet

### Development notes

Don't forget to setup keycloak password policy

In terms of performances, it is better to use a reverse proxy than integrate SSL in the application (https://fastify.dev/docs/latest/Guides/Recommendations/#use-a-reverse-proxy)

For being able to log in Discord user:
- Discord is brokered by Keycloak as an identity provider, so this service never handles Discord credentials nor issues tokens itself. It only validates the tokens it receives. See [the Keycloak README](../keycloak/README.md) for the provider setup.

In keycloak client scopes, add "openid" and inside it enable "Include in token scope"
