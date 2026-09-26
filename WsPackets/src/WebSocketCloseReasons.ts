export const WEBSOCKET_SESSION_REPLACED_REASON = "New connection opened for this account";

export const WEBSOCKET_ACCOUNT_DELETED_REASON = "Account deleted";

export type WebSocketCloseReason = typeof WEBSOCKET_SESSION_REPLACED_REASON | typeof WEBSOCKET_ACCOUNT_DELETED_REASON;
