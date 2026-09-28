export const WEBSOCKET_SESSION_REPLACED_REASON = "New connection opened for this account";

export const WEBSOCKET_ACCOUNT_DELETED_REASON = "Account deleted";

export const WEBSOCKET_APP_OUTDATED_REASON = "App outdated";

export const WEBSOCKET_SERVER_OUTDATED_REASON = "Server outdated";

export type WebSocketCloseReason = typeof WEBSOCKET_SESSION_REPLACED_REASON
	| typeof WEBSOCKET_ACCOUNT_DELETED_REASON
	| typeof WEBSOCKET_APP_OUTDATED_REASON
	| typeof WEBSOCKET_SERVER_OUTDATED_REASON;
