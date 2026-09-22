export class RestApi {
	private static getBaseUrl(): string {
		const url = process.env.EXPO_PUBLIC_REST_API_URL;
		if (!url) {
			throw new Error("REST_API_URL is not defined in the environment variables.");
		}
		return url;
	}

	private static async get<T>(endpoint: string, headers: Record<string, string> = {}): Promise<T> {
		const response = await fetch(`${RestApi.getBaseUrl()}/${endpoint}`, {
			method: "GET",
			headers: {
				"Content-Type": "application/json",
				...headers
			}
		});

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}

		return await response.json() as Promise<T>;
	}

	public static async getAssets(): Promise<{ file: string, hash: string }[]> {
		const response = await RestApi.get<{ [key: string]: string }>("assets/hashes");

		if (!response || typeof response !== 'object') {
			throw new Error("Failed to fetch assets: Invalid response from server.");
		}

		return Object.entries(response).map(entry => ({
			file: entry[0],
			hash: entry[1]
		}));
	}

	public static async downloadAsset(file: string): Promise<string> {
		if (!file) {
			throw new Error("File parameter is required");
		}

		const response = await fetch(`${RestApi.getBaseUrl()}/assets/download?file=${encodeURIComponent(file)}`, {
			method: "GET",
			headers: {
				"Content-Type": "application/text"
			}
		});

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}

		return await response.text();
	}

	/** Returns the status rather than throwing: every code the route answers means something to say. */
	public static async register(account: {
		username: string;
		email: string;
		password: string;
		language: string;
	}): Promise<number> {
		const response = await fetch(`${RestApi.getBaseUrl()}/register`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json"
			},
			body: JSON.stringify(account)
		});

		return response.status;
	}

	/** The account removed is the one the token belongs to: nothing identifies it in the request. */
	public static async deleteAccount(accessToken: string, code: string): Promise<boolean> {
		const response = await fetch(`${RestApi.getBaseUrl()}/account`, {
			method: "DELETE",
			headers: {
				"Content-Type": "application/json",
				"Authorization": `Bearer ${accessToken}`
			},
			body: JSON.stringify({ code })
		});

		return response.ok;
	}

	/** Asks an administrator for a deletion code; the account is only removed once it is confirmed. */
	public static async requestAccountDeletion(accessToken: string): Promise<boolean> {
		const response = await fetch(`${RestApi.getBaseUrl()}/account/deletion-request`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"Authorization": `Bearer ${accessToken}`
			}
		});

		return response.ok;
	}
}