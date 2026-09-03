#!/bin/zsh
set -euo pipefail

script_dir="$(cd "${0:h}" && pwd)"
app_dir="$(cd "$script_dir/.." && pwd)"
platform="ios"
transport="network"
dev_client=false
dry_run=false

print_usage() {
	print 'Usage: start-mobile.sh [options]'
	print ''
	print 'Options:'
	print '  --ios             Target an iPhone or iOS simulator (default)'
	print '  --android         Target an Android device or emulator'
	print '  --usb             Use USB transport (Android uses adb reverse)'
	print '  --dev-client      Start the installed development build'
	print '  --expo-go         Start Expo Go (default)'
	print '  --dry-run         Print the resolved URLs without starting Metro'
	print '  --help            Show this help'
}

while (( $# > 0 )); do
	case "$1" in
		--ios)
			platform="ios"
			;;
		--android)
			platform="android"
			;;
		--usb)
			transport="usb"
			;;
		--dev-client)
			dev_client=true
			;;
		--expo-go)
			dev_client=false
			;;
		--dry-run)
			dry_run=true
			;;
		--help|-h)
			print_usage
			exit 0
			;;
		*)
			print -u2 "Unknown option: $1"
			print_usage >&2
			exit 2
			;;
	esac
	shift
done

if [[ -n "${CROWNICLES_DEVICE_HOST:-}" ]]; then
	device_host="$CROWNICLES_DEVICE_HOST"
elif [[ -n "${CROWNICLES_HOST:-}" ]]; then
	device_host="$CROWNICLES_HOST"
elif [[ "$platform" == "android" && "$transport" == "usb" ]]; then
	device_host="127.0.0.1"
elif [[ -x /usr/sbin/scutil ]]; then
	device_host="$(/usr/sbin/scutil --get LocalHostName).local"
elif command -v hostname >/dev/null 2>&1; then
	device_host="$(hostname).local"
else
	print -u2 "Set CROWNICLES_DEVICE_HOST when the local hostname cannot be detected"
	exit 1
fi

if [[ "$platform" == "android" && "$transport" == "usb" && ! $dry_run ]]; then
	adb_path="${ADB:-}"
	if [[ -z "$adb_path" ]]; then
		adb_path="$(command -v adb 2>/dev/null || true)"
	fi
	if [[ -z "$adb_path" ]]; then
		for candidate in /opt/homebrew/bin/adb /usr/local/bin/adb; do
			if [[ -x "$candidate" ]]; then
				adb_path="$candidate"
				break
			fi
		done
	fi
	if [[ -z "$adb_path" ]]; then
		print -u2 "Android USB mode requires adb. Install Android platform-tools or set ADB."
		exit 1
	fi
	"$adb_path" reverse tcp:8080 tcp:8080
	"$adb_path" reverse tcp:10500 tcp:10500
	"$adb_path" reverse tcp:10501 tcp:10501
fi

rest_url="${CROWNICLES_REST_API_URL:-http://${device_host}:10500}"
websocket_url="${CROWNICLES_WEBSOCKET_URL:-ws://${device_host}:10501}"
if [[ -n "${CROWNICLES_KEYCLOAK_URL:-}" ]]; then
	keycloak_url="$CROWNICLES_KEYCLOAK_URL"
elif [[ "$platform" == "android" && "$transport" == "usb" ]]; then
	keycloak_url="http://127.0.0.1:8080"
else
	keycloak_url="http://${device_host}:8080"
fi
keycloak_base="${keycloak_url%/}"
expo_host="${CROWNICLES_EXPO_HOST:-tunnel}"
case "$expo_host" in
	lan|tunnel|localhost)
		;;
	*)
		print -u2 "CROWNICLES_EXPO_HOST must be lan, tunnel or localhost"
		exit 2
		;;
esac

cd "$app_dir"
export EXPO_PUBLIC_REST_API_URL="$rest_url"
export EXPO_PUBLIC_WEBSOCKET_URL="$websocket_url"
export EXPO_PUBLIC_KEYCLOAK_URL="$keycloak_url"
export EXPO_PUBLIC_KEYCLOAK_REALM="${EXPO_PUBLIC_KEYCLOAK_REALM:-Crownicles}"
export EXPO_PUBLIC_KEYCLOAK_CLIENT_ID="${EXPO_PUBLIC_KEYCLOAK_CLIENT_ID:-crownicles-app}"

printf 'Mobile target: %s (%s)\n' "$platform" "$transport"
printf 'Device host: %s\n' "$device_host"
printf 'REST API: %s\n' "$rest_url"
printf 'WebSocket: %s\n' "$websocket_url"
printf 'Keycloak: %s\n' "$keycloak_url"
printf 'Discord redirect (register once): %s/realms/Crownicles/broker/discord/endpoint\n' "$keycloak_base"
printf 'Metro host: %s\n' "$expo_host"
if [[ "$platform" == "ios" && "$transport" == "usb" ]]; then
	printf 'iOS USB mode needs Personal Hotspot or USB tethering enabled.\n'
elif [[ "$platform" == "android" && "$transport" == "usb" ]]; then
	printf 'Android USB reverse ports configured through adb.\n'
fi

if $dry_run; then
	exit 0
fi

expo_args=(--host "$expo_host" --clear)
if $dev_client; then
	expo_args+=(--dev-client)
else
	expo_args+=(--go)
fi

exec pnpm exec expo start "${expo_args[@]}"
