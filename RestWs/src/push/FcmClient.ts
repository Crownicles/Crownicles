import { sign } from "node:crypto";
import { readFileSync } from "node:fs";
import { PushDevice } from "../../../Lib/src/types/PushDevices";
import { CrowniclesLogger } from "../../../Lib/src/logs/CrowniclesLogger";
import {
	base64UrlJson, collapseKeyOf, PUSH_RESULTS, PushMessage, PushResult, PushSender
} from "./PushSender";

/** The part of a Firebase service account file this server needs. */
export type ServiceAccount = {
	project_id: string;
	client_email: string;
	private_key: string;
	token_uri: string;
};

const MESSAGING_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";

const JWT_BEARER_GRANT = "urn:ietf:params:oauth:grant-type:jwt-bearer";

const ASSERTION_LIFETIME_SECONDS = 3600;

/** An access token is renewed a minute before Google says it expires, so none is sent stale. */
const ACCESS_TOKEN_MARGIN_MS = 60_000;

const REQUEST_TIMEOUT_MS = 10_000;

const HTTP_NOT_FOUND = 404;

const HTTP_UNAUTHORIZED = 401;

/** What FCM answers for a token that no longer designates an installed app. */
const UNREGISTERED = "UNREGISTERED";

type FcmError = {
	error?: {
		status?: string;
		details?: { errorCode?: string }[];
	};
};

export type FcmMessage = {
	message: {
		token: string;
		notification: {
			title: string;
			body: string;
		};
		data: Record<string, string>;
		android: {
			priority: "HIGH";
			collapse_key?: string;
			notification: {
				channel_id: string;
				tag?: string;
			};
		};
	};
};

/** Each kind has its own Android channel, created by the app, so the player can silence one from the system. */
export function fcmMessageOf(device: PushDevice, message: PushMessage): FcmMessage {
	const collapseKey = collapseKeyOf(message.notificationType);
	return {
		message: {
			token: device.token,
			notification: {
				title: message.title,
				body: message.body
			},
			data: { notificationType: message.notificationType },
			android: {
				priority: "HIGH",
				// eslint-disable-next-line camelcase -- FCM's field name
				...collapseKey ? { collapse_key: collapseKey } : {},
				notification: {
					// eslint-disable-next-line camelcase -- FCM's field name
					channel_id: message.notificationType,
					...collapseKey ? { tag: collapseKey } : {}
				}
			}
		}
	};
}

/** Whether FCM's answer means the device must be forgotten. */
export function isInvalidFcmToken(status: number, answer: FcmError): boolean {
	return status === HTTP_NOT_FOUND || answer.error?.details?.some(detail => detail.errorCode === UNREGISTERED) === true;
}

/** What the service account signs to be given an access token to FCM, for an hour. */
export function signServiceAccountAssertion(account: ServiceAccount, issuedAtSeconds: number): string {
	const unsigned = `${base64UrlJson({
		alg: "RS256",
		typ: "JWT"
	})}.${base64UrlJson({
		iss: account.client_email,
		scope: MESSAGING_SCOPE,
		aud: account.token_uri,
		iat: issuedAtSeconds,
		exp: issuedAtSeconds + ASSERTION_LIFETIME_SECONDS
	})}`;
	return `${unsigned}.${sign("RSA-SHA256", Buffer.from(unsigned), account.private_key).toString("base64url")}`;
}

/**
 * Talks to Firebase Cloud Messaging (HTTP v1) with a service account: the server signs its own
 * request for an access token, so no Google library is needed.
 */
export class FcmClient implements PushSender {
	private readonly account: ServiceAccount;

	private accessToken: {
		value: string;
		expiresAt: number;
	} | null = null;

	public constructor(serviceAccountPath: string) {
		this.account = JSON.parse(readFileSync(serviceAccountPath, "utf8")) as ServiceAccount;
	}

	public async send(device: PushDevice, message: PushMessage): Promise<PushResult> {
		const response = await fetch(`https://fcm.googleapis.com/v1/projects/${this.account.project_id}/messages:send`, {
			method: "POST",
			headers: {
				"authorization": `Bearer ${await this.token()}`,
				"content-type": "application/json"
			},
			body: JSON.stringify(fcmMessageOf(device, message)),
			signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
		});
		if (response.ok) {
			return PUSH_RESULTS.SENT;
		}
		const answer = await response.json().catch(() => ({})) as FcmError;
		if (isInvalidFcmToken(response.status, answer)) {
			return PUSH_RESULTS.INVALID_TOKEN;
		}
		if (response.status === HTTP_UNAUTHORIZED) {
			this.accessToken = null;
		}
		CrowniclesLogger.warn("FCM refused a notification", {
			status: response.status,
			fcmStatus: answer.error?.status ?? "unknown"
		});
		return PUSH_RESULTS.FAILED;
	}

	private async token(): Promise<string> {
		if (this.accessToken && Date.now() < this.accessToken.expiresAt) {
			return this.accessToken.value;
		}
		const response = await fetch(this.account.token_uri, {
			method: "POST",
			headers: { "content-type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				// eslint-disable-next-line camelcase -- OAuth's field name
				grant_type: JWT_BEARER_GRANT,
				assertion: signServiceAccountAssertion(this.account, Math.floor(Date.now() / 1000))
			}),
			signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
		});
		if (!response.ok) {
			throw new Error(`Google refused the FCM service account (${response.status})`);
		}
		const answer = await response.json() as {
			access_token: string;
			expires_in: number;
		};
		this.accessToken = {
			value: answer.access_token,
			expiresAt: Date.now() + answer.expires_in * 1000 - ACCESS_TOKEN_MARGIN_MS
		};
		return this.accessToken.value;
	}
}
