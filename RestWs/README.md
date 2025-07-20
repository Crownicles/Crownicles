## ⚠️ This module is in development so the README is not written yet

### Development notes

Don't forget to setup keycloak password policy

In terms of performances, it is better to use a reverse proxy than integrate SSL in the application (https://fastify.dev/docs/latest/Guides/Recommendations/#use-a-reverse-proxy)

For being able to log in Discord user:
- Add the following feature to keycloak using this environment variable: `KC_FEATURES: token-exchange`
- the client must have the role "impersonation"

In keycloak client scopes, add "openid" and inside it enable "Include in token scope"
