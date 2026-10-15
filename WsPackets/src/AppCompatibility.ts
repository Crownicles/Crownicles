/** Bump whenever the app and RestWs stop understanding each other: across a mismatch, neither side lets the game start. */
export const APP_PROTOCOL_VERSION = 2;

/** The WebSocket query parameter carrying the app's protocol version. */
export const APP_PROTOCOL_QUERY_PARAMETER = "protocol";

/** The same version, as the HTTP header of the routes a session goes through before its WebSocket opens. */
export const APP_PROTOCOL_HEADER = "x-crownicles-protocol";

/** What `GET /app/compatibility` answers. */
export type AppCompatibility = {
	protocolVersion: number;
};

export const APP_COMPATIBILITY_STATUSES = {
	UP_TO_DATE: "upToDate",
	APP_OUTDATED: "appOutdated",
	SERVER_OUTDATED: "serverOutdated"
} as const;

export type AppCompatibilityStatus = typeof APP_COMPATIBILITY_STATUSES[keyof typeof APP_COMPATIBILITY_STATUSES];

export type AppOutdatedStatus = Exclude<AppCompatibilityStatus, typeof APP_COMPATIBILITY_STATUSES.UP_TO_DATE>;

/** HTTP 426 body of a versioned route refusing an app that speaks another protocol. */
export type AppIncompatibility = {
	error: AppOutdatedStatus;
};

/** Which side must be updated for an app speaking `appVersion` to play on a server speaking `serverVersion`. */
export function compareProtocolVersions(appVersion: number, serverVersion: number): AppCompatibilityStatus {
	if (appVersion === serverVersion) {
		return APP_COMPATIBILITY_STATUSES.UP_TO_DATE;
	}
	return appVersion < serverVersion ? APP_COMPATIBILITY_STATUSES.APP_OUTDATED : APP_COMPATIBILITY_STATUSES.SERVER_OUTDATED;
}
