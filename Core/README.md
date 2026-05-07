# Core

Repository for the core of Crownicles

## Tests

### Unit tests

```bash
pnpm test
```

### Integration tests

Integration tests live under `__tests__-integration/` and exercise the
real MariaDB-backed locking primitives end-to-end (transactions, row
locks, CLS propagation). They require a reachable MariaDB instance.

By default the helpers in `__tests__-integration/_setup.ts` connect to
`127.0.0.1:3306` with the credentials from `config/config.default.toml`.
Override via env vars when needed:

| Variable | Default |
|---|---|
| `TEST_DB_HOST` | `127.0.0.1` |
| `TEST_DB_PORT` | `3306` |
| `TEST_DB_ROOT_USER` | `root` |
| `TEST_DB_ROOT_PASSWORD` | `super_secret_password` |
| `TEST_DB_USER` | `draftbot` |
| `TEST_DB_PASSWORD` | `secret_password` |

Each test suite provisions a unique throw-away schema
(`crownicles_test_<suite>_<pid>_<rand>`) and drops it on teardown, so
runs are isolated and safe to interleave with the dev database.

```bash
pnpm test:integration
```

In CI the `Integration Tests` workflow boots a `mariadb:11` service
container with the same defaults — see
[`.github/workflows/integration-tests.yml`](../.github/workflows/integration-tests.yml).
