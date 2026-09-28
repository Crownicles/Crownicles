import type {AssetsBundle, AssetsBundleLanguage} from "../../../WsPackets/src/objects/AssetsBundle";
import {APP_PROTOCOL_VERSION, AppCompatibility, AppCompatibilityStatus, compareProtocolVersions} from "../../../WsPackets/src/AppCompatibility";

export const REST_TIMEOUT_MS = 15_000;

export type AssetsBundleResponse =
	| {status: "notModified"}
	| {status: "ok"; bundle: AssetsBundle; etag: string};

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

	/** The account removed is the one the token belongs to: nothing identifies it in the request. */
	public static async deleteAccount(accessToken: string, code: string): Promise<boolean> {
		const response = await RestApi.fetchWithTimeout(`${RestApi.getBaseUrl()}/account`, {
			method: "DELETE",
			headers: {
				"Content-Type": "application/json",
				"Authorization": `Bearer ${accessToken}`
			},
			body: JSON.stringify({ code })
		}, REST_TIMEOUT_MS);

		return response.ok;
	}

	/** Asks an administrator for a deletion code; the account is only removed once it is confirmed. */
	public static async requestAccountDeletion(accessToken: string): Promise<boolean> {
		const response = await RestApi.fetchWithTimeout(`${RestApi.getBaseUrl()}/account/deletion-request`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"Authorization": `Bearer ${accessToken}`
			}
		}, REST_TIMEOUT_MS);

		return response.ok;
	}
}