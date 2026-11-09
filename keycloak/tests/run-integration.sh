#!/usr/bin/env bash
# Runs the Keycloak laboratory test against a disposable Keycloak built from this repository, with
# its extensions and theme. Never point the test at a shared Keycloak: it recreates its own realm.
# Lib, RestWs and App dependencies must be installed; Docker must be running.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
IMAGE="crownicles/keycloak:integration"
KEYCLOAK_CONTAINER="crownicles-keycloak-integration"
MAILPIT_CONTAINER="crownicles-mailpit-integration"
KEYCLOAK_URL="http://127.0.0.1:18180"
MAILPIT_URL="http://127.0.0.1:18025"
READY_ATTEMPTS=90
started=()

cleanup() {
	if [ "${#started[@]}" -gt 0 ]; then
		docker rm --force "${started[@]}" > /dev/null
	fi
}
trap cleanup EXIT

wait_for() {
	local url="$1" container="$2"
	for attempt in $(seq 1 "$READY_ATTEMPTS"); do
		if curl --silent --fail "$url" > /dev/null; then
			return 0
		fi
		if [ "$attempt" -eq "$READY_ATTEMPTS" ]; then
			docker logs "$container" 2>&1 | tail -50
			echo "$container did not start" >&2
			return 1
		fi
		sleep 2
	done
}

if curl --silent --fail "$KEYCLOAK_URL/realms/master" > /dev/null; then
	echo "Something already answers on $KEYCLOAK_URL: stop it first, the test needs its own Keycloak." >&2
	exit 1
fi

pnpm --dir "$ROOT/Lib" run tsc
pnpm --dir "$ROOT/RestWs" run tsc
docker build --tag "$IMAGE" "$ROOT/keycloak"

# A mail catcher already listening on these ports is reused: the test only reads the mails it sends
if ! curl --silent --fail "$MAILPIT_URL/api/v1/messages" > /dev/null; then
	docker run --detach --name "$MAILPIT_CONTAINER" --publish 18025:8025 --publish 11025:1025 axllent/mailpit:v1.31.2 > /dev/null
	started+=("$MAILPIT_CONTAINER")
	wait_for "$MAILPIT_URL/api/v1/messages" "$MAILPIT_CONTAINER"
fi

# host.docker.internal lets Keycloak reach the test's synthetic Discord and the mail catcher on Linux too
docker run --detach --name "$KEYCLOAK_CONTAINER" --publish 127.0.0.1:18180:8080 \
	--add-host host.docker.internal:host-gateway \
	--env KC_BOOTSTRAP_ADMIN_USERNAME=proof-admin --env KC_BOOTSTRAP_ADMIN_PASSWORD=local-proof-only-password \
	--volume "$ROOT/keycloak/theme:/opt/keycloak/themes/crownicles:ro" \
	"$IMAGE" start-dev > /dev/null
started+=("$KEYCLOAK_CONTAINER")
wait_for "$KEYCLOAK_URL/realms/master" "$KEYCLOAK_CONTAINER"

node --test "$ROOT/keycloak/tests/discord-identity.integration.test.mjs"
