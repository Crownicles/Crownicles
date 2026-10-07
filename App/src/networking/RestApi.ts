import type {AssetsBundle, AssetsBundleLanguage} from "../../../WsPackets/src/objects/AssetsBundle";
import {APP_PROTOCOL_VERSION, AppCompatibility, AppCompatibilityStatus, compareProtocolVersions} from "../../../WsPackets/src/AppCompatibility";
import {
	ACCOUNT_COLLISION_ENDPOINTS, ACCOUNT_COLLISION_ERRORS, AccountCollisionCheck, AccountCollisionChoice,
	AccountCollisionError, AccountCollisionProof, AccountCollisionResolution
} from "../../../WsPackets/src/objects/AccountCollision";

export const REST_TIMEOUT_MS = 15_000;

export const ACCOUNT_DELETION_FAILURES = {
	UNAUTHORIZED: "unauthorized",
	INVALID_CODE: "invalidCode",
	UNAVAILABLE: "unavailable"
} as const;
export type AccountDeletionFailure = typeof ACCOUNT_DELETION_FAILURES[keyof typeof ACCOUNT_DELETION_FAILURES];

export class AccountDeletionRequestFailure extends Error {
	public constructor(public readonly reason: AccountDeletionFailure) {
		super(reason);
	}
}

export type AssetsBundleResponse =
	| {status: "notModified"}
	| {status: "ok"; bundle: AssetsBundle; etag: string};

export class AccountCollisionRequestFailure extends Error {
	public constructor(public readonly reason: AccountCollisionError) {
		super(reason);
	}
}

/** A Keycloak access token: the account it belongs to is the one every request acts on */
type AccessToken = string;
type DeletionCode = string;
type CollisionProof = string;
type AccountCollisionEndpoint = typeof ACCOUNT_COLLISION_ENDPOINTS[keyof typeof ACCOUNT_COLLISION_ENDPOINTS];

/** Whether the account still waits for the player to choose between two accounts sharing an email */
export function isAccountCollisionOpen(check: AccountCollisionCheck): boolean {
	return Boolean(check.collision || check.pending);
}

function deletionFailure(status: number, confirming: boolean): AccountDeletionFailure {
	if (status === 401) return ACCOUNT_DELETION_FAILURES.UNAUTHORIZED;
	return status === 403 && confirming ? ACCOUNT_DELETION_FAILURES.INVALID_CODE : ACCOUNT_DELETION_FAILURES.UNAVAILABLE;
}

export class RestApi {
	private static getBaseUrl(): string {
		const url = process.env.EXPO_PUBLIC_REST_API_URL;
		if (!url) {
			throw new Error("REST_API_URL is not defined in the environment variables.");
		}
		return url;
	}

	private static async fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), timeoutMs);
		try {
			return await fetch(url, {...init, signal: controller.signal});
		}
		finally {
			clearTimeout(timeout);
		}
	}

	private static async get<T>(endpoint: string, headers: Record<string, string> = {}): Promise<T> {
		const response = await RestApi.fetchWithTimeout(`${RestApi.getBaseUrl()}/${endpoint}`, {
			method: "GET",
			headers: {
				"Content-Type": "application/json",
				...headers
			}
		}, REST_TIMEOUT_MS);

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}

		return await response.json() as T;
	}

	/**
	 * Whether this app can play with the server. A server without the route predates the check, so it is the
	 * one behind; a network failure answers null and leaves the WebSocket check to decide.
	 */
	public static async getCompatibility(): Promise<AppCompatibilityStatus | null> {
		try {
			const response = await RestApi.fetchWithTimeout(`${RestApi.getBaseUrl()}/app/compatibility`, {method: "GET"}, REST_TIMEOUT_MS);
			if (response.status === 404) {
				return compareProtocolVersions(APP_PROTOCOL_VERSION, 0);
			}
			if (!response.ok) {
				return null;
			}
			const {protocolVersion} = await response.json() as AppCompatibility;
			return compareProtocolVersions(APP_PROTOCOL_VERSION, protocolVersion);
		}
		catch (error) {
			console.warn("Could not check the app compatibility:", error);
			return null;
		}
	}

	public static async getAssetsBundle(language: AssetsBundleLanguage, etag?: string): Promise<AssetsBundleResponse> {
		const response = await RestApi.fetchWithTimeout(`${RestApi.getBaseUrl()}/assets/bundle?lang=${encodeURIComponent(language)}`, {
				method: "GET",
				headers: {
					"Accept": "application/json",
					...(etag ? {"If-None-Match": etag} : {})
				},
			}, REST_TIMEOUT_MS);

		if (response.status === 304) {
			return {status: "notModified"};
		}
		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}

		const bundle = await response.json() as AssetsBundle;
		const responseEtag = response.headers.get("ETag");
		if (!responseEtag) {
			throw new Error("Assets bundle response is missing its ETag.");
		}
		return {status: "ok", bundle, etag: responseEtag};
	}

	private static async accountDeletionRequest(accessToken: AccessToken, code?: DeletionCode): Promise<boolean> {
		const confirming = code !== undefined;
		const response = await RestApi.fetchWithTimeout(`${RestApi.getBaseUrl()}/account${confirming ? "" : "/deletion-request"}`, {
			method: confirming ? "DELETE" : "POST",
			headers: {
				"Content-Type": "application/json",
				"Authorization": `Bearer ${accessToken}`
			},
			...confirming ? {body: JSON.stringify({code: code.trim().toUpperCase()})} : {}
		}, REST_TIMEOUT_MS);
		if (response.ok) return true;
		throw new AccountDeletionRequestFailure(deletionFailure(response.status, confirming));
	}

	/** The account removed is the one the token belongs to: nothing identifies it in the request. */
	public static deleteAccount(accessToken: AccessToken, code: DeletionCode): Promise<boolean> {
		return RestApi.accountDeletionRequest(accessToken, code);
	}

	/** Asks an administrator for a deletion code; the account is only removed once it is confirmed. */
	public static requestAccountDeletion(accessToken: AccessToken): Promise<boolean> {
		return RestApi.accountDeletionRequest(accessToken);
	}

	private static async accountCollisionRequest<T>(endpoint: AccountCollisionEndpoint, accessToken: AccessToken, body?: object): Promise<T> {
		const response = await RestApi.fetchWithTimeout(`${RestApi.getBaseUrl()}${endpoint}`, {
			method: body ? "POST" : "GET",
			headers: {"Content-Type": "application/json", "Authorization": `Bearer ${accessToken}`},
			...body ? {body: JSON.stringify(body)} : {}
		}, REST_TIMEOUT_MS);
		if (!response.ok) {
			const failure = await response.json() as {error?: AccountCollisionError};
			throw new AccountCollisionRequestFailure(failure.error ?? ACCOUNT_COLLISION_ERRORS.UNAVAILABLE);
		}
		return response.json() as Promise<T>;
	}

	public static checkAccountCollision(accessToken: AccessToken): Promise<AccountCollisionCheck> {
		return RestApi.accountCollisionRequest(ACCOUNT_COLLISION_ENDPOINTS.CHECK, accessToken);
	}

	public static verifyAccountCollision(discordToken: AccessToken, emailToken: AccessToken): Promise<AccountCollisionProof> {
		return RestApi.accountCollisionRequest(ACCOUNT_COLLISION_ENDPOINTS.VERIFY, discordToken, {emailToken});
	}

	public static resolveAccountCollision(accessToken: AccessToken, proof: CollisionProof, keep: AccountCollisionChoice): Promise<AccountCollisionResolution> {
		return RestApi.accountCollisionRequest(ACCOUNT_COLLISION_ENDPOINTS.RESOLVE, accessToken, {proof, keep});
	}
}