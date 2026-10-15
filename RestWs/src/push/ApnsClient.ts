import {
	ClientHttp2Session, connect, constants
} from "node:http2";
import {
	createPrivateKey, KeyObject, sign
} from "node:crypto";
import { readFileSync } from "node:fs";
import { PushDevice } from "../../../Lib/src/types/PushDevices";
import { CrowniclesLogger } from "../../../Lib/src/logs/CrowniclesLogger";
import { PushConfig } from "../config/RestWsConfig";
import {
	base64UrlJson, collapseKeyOf, PUSH_RESULTS, PushMessage, PushResult, PushSender
} from "./PushSender";

const APNS_HOSTS = {
	production: "https://api.push.apple.com",
	sandbox: "https://api.sandbox.push.apple.com"
} as const;

/** Apple refuses a token older than an hour, and throttles one renewed more often than every twenty minutes. */
const TOKEN_RENEWAL_MS = 50 * 60 * 1000;

const REQUEST_TIMEOUT_MS = 10_000;

/** What Apple answers for a token that no longer designates an installed app. */
const INVALID_TOKEN_REASONS: ReadonlySet<string> = new Set([
	"BadDeviceToken",
	"DeviceTokenNotForTopic",
	"Unregistered"
]);

const EXPIRED_PROVIDER_TOKEN = "ExpiredProviderToken";

type ApnsResponse = {
	status: number;
	reason?: string;
};

export type ApnsPayload = {
	aps: {
		"alert": {
			title: string;
			body: string;
		};
		"sound": string;
		"thread-id": string;
	};

	/** expo-notifications reads a remote notification's data from this key only. */
	body: {
		notificationType: string;
	};
};

export function apnsPayloadOf(message: PushMessage): ApnsPayload {
	return {
		aps: {
			"alert": {
				title: message.title,
				body: message.body
			},
			"sound": "default",
			"thread-id": message.notificationType
		},
		body: { notificationType: message.notificationType }
	};
}

/** Whether Apple's answer means the device must be forgotten. */
export function isInvalidApnsToken(response: ApnsResponse): boolean {
	return response.status === constants.HTTP_STATUS_GONE || response.reason !== undefined && INVALID_TOKEN_REASONS.has(response.reason);
}

/** Apple explains a refusal in a JSON body; a success has none. */
function reasonOf(body: string): { reason?: string } {
	try {
		const { reason } = JSON.parse(body) as { reason?: unknown };
		return typeof reason === "string" ? { reason } : {};
	}
	catch {
		return {};
	}
}

/** The provider token Apple asks for: a JWT signed with the team's push key, valid for an hour. */
export function signApnsToken(key: KeyObject, config: Pick<PushConfig["APNS"], "KEY_ID" | "TEAM_ID">, issuedAtSeconds: number): string {
	const unsigned = `${base64UrlJson({
		alg: "ES256",
		kid: config.KEY_ID
	})}.${base64UrlJson({
		iss: config.TEAM_ID,
		iat: issuedAtSeconds
	})}`;
	const signature = sign("sha256", Buffer.from(unsigned), {
		key,
		dsaEncoding: "ieee-p1363"
	}).toString("base64url");
	return `${unsigned}.${signature}`;
}

/**
 * Talks to Apple's push service over HTTP/2, one long-lived connection per gateway, signing with the team's
 * push key rather than a certificate: the key never expires and serves every app of the team.
 */
export class ApnsClient implements PushSender {
	private readonly key: KeyObject;

	private readonly sessions = new Map<boolean, ClientHttp2Session>();

	private token: {
		value: string;
		issuedAt: number;
	} | null = null;

	public constructor(private readonly config: PushConfig["APNS"]) {
		this.key = createPrivateKey(readFileSync(config.KEY_PATH));
	}

	public async send(device: PushDevice, message: PushMessage): Promise<PushResult> {
		const response = await this.post(device, message);
		if (response.status === constants.HTTP_STATUS_OK) {
			return PUSH_RESULTS.SENT;
		}
		if (isInvalidApnsToken(response)) {
			return PUSH_RESULTS.INVALID_TOKEN;
		}
		if (response.reason === EXPIRED_PROVIDER_TOKEN) {
			this.token = null;
		}
		CrowniclesLogger.warn("APNs refused a notification", {
			status: response.status,
			reason: response.reason,
			sandbox: device.sandbox
		});
		return PUSH_RESULTS.FAILED;
	}

	private providerToken(): string {
		const now = Date.now();
		if (this.token && now - this.token.issuedAt < TOKEN_RENEWAL_MS) {
			return this.token.value;
		}
		this.token = {
			value: signApnsToken(this.key, this.config, Math.floor(now / 1000)),
			issuedAt: now
		};
		return this.token.value;
	}

	private session(sandbox: boolean): ClientHttp2Session {
		const existing = this.sessions.get(sandbox);
		const reusable = existing && !existing.closed && !existing.destroyed;
		if (reusable) {
			return existing;
		}
		const session = connect(sandbox ? APNS_HOSTS.sandbox : APNS_HOSTS.production);
		const forget = (): void => {
			if (this.sessions.get(sandbox) === session) {
				this.sessions.delete(sandbox);
			}
		};
		session.on("error", error => {
			CrowniclesLogger.errorWithObj("APNs connection error", error);
			forget();
		});
		session.on("goaway", forget);
		session.on("close", forget);
		this.sessions.set(sandbox, session);
		return session;
	}

	private post(device: PushDevice, message: PushMessage): Promise<ApnsResponse> {
		return new Promise(resolve => {
			const collapseId = collapseKeyOf(message.notificationType);
			const request = this.session(device.sandbox).request({
				":method": "POST",
				":path": `/3/device/${device.token}`,
				"authorization": `bearer ${this.providerToken()}`,
				"apns-topic": this.config.BUNDLE_ID,
				"apns-push-type": "alert",
				"apns-priority": "10",
				"content-type": "application/json",
				...collapseId ? { "apns-collapse-id": collapseId } : {}
			});
			let status = 0;
			let body = "";
			request.setEncoding("utf8");
			request.setTimeout(REQUEST_TIMEOUT_MS, () => request.close(constants.NGHTTP2_CANCEL));
			request.on("response", headers => {
				status = Number(headers[constants.HTTP2_HEADER_STATUS]);
			});
			request.on("data", (chunk: string) => {
				body += chunk;
			});
			request.on("error", error => {
				CrowniclesLogger.errorWithObj("APNs request error", error);
				resolve({ status: 0 });
			});
			request.on("close", () => resolve({
				status,
				...reasonOf(body)
			}));
			request.end(JSON.stringify(apnsPayloadOf(message)));
		});
	}
}
