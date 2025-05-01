import { KeycloakConfig } from "./KeycloakConfig";
import { KeycloakUserToRegister } from "./KeycloakUserToRegister";
import { KeycloakUser } from "./KeycloakUser";
import { Language } from "../Language";
import { KeycloakOAuth2Token } from "./KeycloakOAuth2Token";

/**
 * Return type of keycloak API call
 */
type ApiCallReturnType<T extends object> =
	| {
		isError: true;
		status: number;
		payload: { error?: object };
	}
	| {
		isError: false;
		status: number;
		payload: T;
	};

/**
 * Format the response of an API call as an error
 * @param res
 */
async function formatApiCallError<T extends object>(res: Response): Promise<ApiCallReturnType<T>> {
	const payload = await res.json();
	return {
		status: res.status,
		payload: "error" in payload ? payload : {},
		isError: true
	};
}

/**
 * Format the response of an API call as a success
 * @param res
 * @param payload
 */
function formatApiCallOk<T extends object>(res: Response, payload: T): ApiCallReturnType<T> {
	return {
		status: res.status,
		payload,
		isError: false
	};
}

export class KeycloakUtils {
	private static keycloakToken: string | null = null;

	private static keycloakTokenExpirationDate: number | null = null;

	private static keycloakDiscordToIdMap = new Map<string, string>();

	private static keycloakUserGroupsMap = new Map<string, string[]>();

	private static readonly cacheCleanInterval = 1000 * 60 * 10; // 10 minutes

	private static nextCacheClean: Date;

	/**
	 * Get the groups of a user from its keycloak ID
	 * @param keycloakConfig
	 * @param keycloakId
	 */
	public static async getUserGroups(keycloakConfig: KeycloakConfig, keycloakId: string): Promise<ApiCallReturnType<{ groups: string[] }>> {
		if (!this.nextCacheClean || this.nextCacheClean < new Date()) {
			this.keycloakUserGroupsMap.clear();
			this.nextCacheClean = new Date(Date.now() + this.cacheCleanInterval);
		}
		else {
			const groups = this.keycloakUserGroupsMap.get(keycloakId);
			if (groups) {
				return {
					status: 200,
					payload: { groups },
					isError: false
				};
			}
		}

		const checkAndQueryToken = await this.checkAndQueryToken(keycloakConfig);
		if (checkAndQueryToken.isError) {
			return checkAndQueryToken;
		}

		const res = await fetch(`${keycloakConfig.url}/admin/realms/${keycloakConfig.realm}/users/${keycloakId}/groups`, {
			method: "GET",
			headers: {
				"Authorization": `Bearer ${this.keycloakToken}`,
				"Content-Type": "application/json"
			}
		});

		if (!res.ok) {
			return formatApiCallError(res);
		}

		const groups = (await res.json() as { name: string }[]).map(group => group.name);

		this.keycloakUserGroupsMap.set(keycloakId, groups);

		return formatApiCallOk(res, { groups });
	}

	/**
	 * Get a keycloak user from its keycloak ID
	 * @param keycloakConfig
	 * @param keycloakId
	 */
	public static async getUserByKeycloakId(keycloakConfig: KeycloakConfig, keycloakId: string): Promise<ApiCallReturnType<{ user: KeycloakUser }>> {
		const checkAndQueryToken = await this.checkAndQueryToken(keycloakConfig);
		if (checkAndQueryToken.isError) {
			return checkAndQueryToken;
		}

		const res = await fetch(`${keycloakConfig.url}/admin/realms/${keycloakConfig.realm}/users/${keycloakId}`, {
			method: "GET",
			headers: {
				"Authorization": `Bearer ${this.keycloakToken}`,
				"Content-Type": "application/json"
			}
		});

		if (!res.ok) {
			return formatApiCallError(res);
		}

		return formatApiCallOk(res, { user: await res.json() as KeycloakUser });
	}

	/**
	 * Get a keycloak user from its username
	 * @param keycloakConfig
	 * @param username
	 */
	public static async getUserIdByUsername(keycloakConfig: KeycloakConfig, username: string): Promise<ApiCallReturnType<{ user?: KeycloakUser }>> {
		const checkAndQueryToken = await this.checkAndQueryToken(keycloakConfig);
		if (checkAndQueryToken.isError) {
			return checkAndQueryToken;
		}

		const res = await fetch(`${keycloakConfig.url}/admin/realms/${keycloakConfig.realm}/users?username=${username}`, {
			method: "GET",
			headers: {
				"Authorization": `Bearer ${this.keycloakToken}`,
				"Content-Type": "application/json"
			}
		});

		if (!res.ok) {
			return formatApiCallError(res);
		}

		const obj = await res.json() as KeycloakUser[];

		if (obj.length === 0) {
			return formatApiCallOk(res, {});
		}

		return formatApiCallOk(res, { user: obj[0] });
	}

	/**
	 * Register a user in Keycloak
	 * @param keycloakConfig
	 * @param registerParams
	 */
	public static async registerUser(keycloakConfig: KeycloakConfig, registerParams: KeycloakUserToRegister): Promise<ApiCallReturnType<{ user: KeycloakUser }>> {
		const checkAndQueryToken = await this.checkAndQueryToken(keycloakConfig);
		if (checkAndQueryToken.isError) {
			return checkAndQueryToken;
		}

		// Populate attributes
		const attributes: { [key: string]: string[] } = {};
		attributes.language = [registerParams.language];
		attributes.gameUsername = [registerParams.gameUsername];
		if (registerParams.discordId) {
			attributes.discordId = [registerParams.discordId];
		}

		const res = await fetch(`${keycloakConfig.url}/admin/realms/${keycloakConfig.realm}/users`, {
			method: "POST",
			headers: {
				"Authorization": `Bearer ${this.keycloakToken}`,
				"Content-Type": "application/json"
			},
			body: JSON.stringify({
				username: registerParams.keycloakUsername,
				attributes,
				enabled: true,
				credentials: registerParams.password
					? [
						{
							type: "password",
							value: registerParams.password,
							temporary: false
						}
					]
					: undefined
			})
		});

		if (!res.ok) {
			return formatApiCallError(res);
		}

		const getUser = await this.getUserIdByUsername(keycloakConfig, registerParams.keycloakUsername);

		if (getUser.isError || !("user" in getUser.payload)) {
			return formatApiCallError(res);
		}

		return formatApiCallOk(res, { user: getUser.payload.user! });
	}

	/**
	 * Get a user from its discordId
	 * @param keycloakConfig
	 * @param discordId
	 * @param gameUsername - Optional game username to update if known
	 */
	public static async getDiscordUser(keycloakConfig: KeycloakConfig, discordId: string, gameUsername: string | null): Promise<ApiCallReturnType<{ user: KeycloakUser }>> {
		const checkAndQueryToken = await this.checkAndQueryToken(keycloakConfig);
		if (checkAndQueryToken.isError) {
			return checkAndQueryToken;
		}

		const res = await fetch(`${keycloakConfig.url}/admin/realms/${keycloakConfig.realm}/users?q=discordId:${discordId}`, {
			method: "GET",
			headers: {
				"Authorization": `Bearer ${this.keycloakToken}`,
				"Content-Type": "application/json"
			}
		});

		if (!res.ok) {
			return formatApiCallError(res);
		}

		const obj = await res.json();
		const user: KeycloakUser = obj.length === 1 ? obj[0] : null;

		if (user) {
			if (gameUsername && user.attributes.gameUsername[0] !== gameUsername) {
				await KeycloakUtils.updateGameUsername(user, gameUsername, keycloakConfig);
			}

			KeycloakUtils.keycloakDiscordToIdMap.set(discordId, user.id);
		}

		return formatApiCallOk(res, { user });
	}

	/**
	 * Get a user from its discordId or register it if it doesn't exist
	 * @param keycloakConfig
	 * @param discordId
	 * @param gameUsername
	 * @param language
	 */
	public static async getOrRegisterDiscordUser(keycloakConfig: KeycloakConfig, discordId: string, gameUsername: string, language: string): Promise<ApiCallReturnType<{ user: KeycloakUser }>> {
		const checkAndQueryToken = await this.checkAndQueryToken(keycloakConfig);
		if (checkAndQueryToken.isError) {
			return checkAndQueryToken;
		}

		const res = await this.getUserFromDiscordId(keycloakConfig, discordId);

		if (!res.ok) {
			return formatApiCallError(res);
		}

		const obj = await res.json();
		let user: KeycloakUser;
		if (obj.length === 0) {
			const registerUser = await this.registerUser(keycloakConfig, {
				keycloakUsername: `discord-${discordId}`,
				gameUsername,
				discordId,
				language
			});
			if (registerUser.isError) {
				return registerUser;
			}
			user = registerUser.payload.user;
		}
		else {
			user = obj[0] as KeycloakUser;

			if (gameUsername && user.attributes.gameUsername[0] !== gameUsername) {
				await KeycloakUtils.updateGameUsername(user, gameUsername, keycloakConfig);
			}
		}

		KeycloakUtils.keycloakDiscordToIdMap.set(discordId, user.id);

		return formatApiCallOk(res, { user });
	}

	/**
	 * Get the keycloak ID from a discord ID
	 * @param keycloakConfig
	 * @param discordId
	 * @param gameUsername
	 */
	public static async getKeycloakIdFromDiscordId(keycloakConfig: KeycloakConfig, discordId: string, gameUsername: string | null): Promise<ApiCallReturnType<{ keycloakId?: string }>> {
		const cachedId = KeycloakUtils.keycloakDiscordToIdMap.get(discordId);
		if (cachedId) {
			return {
				status: 200,
				payload: { keycloakId: cachedId },
				isError: false
			};
		}

		const checkAndQueryToken = await this.checkAndQueryToken(keycloakConfig);
		if (checkAndQueryToken.isError) {
			return checkAndQueryToken;
		}

		const res = await this.getUserFromDiscordId(keycloakConfig, discordId);

		if (!res.ok) {
			return formatApiCallError(res);
		}

		const obj = await res.json();
		const user = obj.length === 0 ? null : obj[0] as KeycloakUser;
		const id = user?.id;

		if (user && id) {
			KeycloakUtils.keycloakDiscordToIdMap.set(discordId, id);

			if (gameUsername && user.attributes.gameUsername[0] !== gameUsername) {
				await KeycloakUtils.updateGameUsername(user, gameUsername, keycloakConfig);
			}
		}

		return formatApiCallOk(res, { keycloakId: id });
	}

	/**
	 * Update the language of a user
	 */
	// Needed because the return type must be an object
	/* eslint-disable @typescript-eslint/no-empty-object-type */
	public static async updateUserLanguage(keycloakConfig: KeycloakConfig, user: KeycloakUser, newLanguage: Language): Promise<ApiCallReturnType<{}>> {
		const checkAndQueryToken = await this.checkAndQueryToken(keycloakConfig);
		if (checkAndQueryToken.isError) {
			return checkAndQueryToken;
		}

		// Update the language attribute
		const attributes = user.attributes;
		attributes.language = [newLanguage];

		// Send the update request to Keycloak
		const res = await fetch(`${keycloakConfig.url}/admin/realms/${keycloakConfig.realm}/users/${user.id}`, {
			method: "PUT",
			headers: {
				"Authorization": `Bearer ${this.keycloakToken}`,
				"Content-Type": "application/json"
			},
			body: JSON.stringify({
				attributes
			})
		});

		if (!res.ok) {
			return formatApiCallError(res);
		}

		return formatApiCallOk(res, {});
	}

	/**
	 * Get the language of a user from its attributes
	 * @param user
	 */
	public static getUserLanguage(user: KeycloakUser): Language {
		return user.attributes.language[0];
	}

	/**
	 * Get multiple users from their keycloak IDs
	 * @param keycloakConfig
	 * @param keycloakIds
	 */
	// TODO Wait for https://github.com/keycloak/keycloak/pull/34582 to be merged and released to use the bulk endpoint
	public static async getUsersFromIds(keycloakConfig: KeycloakConfig, keycloakIds: string[]): Promise<ApiCallReturnType<{ users: KeycloakUser[] }>> {
		const checkAndQueryToken = await this.checkAndQueryToken(keycloakConfig);
		if (checkAndQueryToken.isError) {
			return checkAndQueryToken;
		}

		const users = [];
		for (const keycloakId of keycloakIds) {
			const getUser = await KeycloakUtils.getUserIdByUsername(keycloakConfig, keycloakId);
			if (getUser.isError || !("user" in getUser.payload)) {
				return {
					status: getUser.status,
					payload: getUser.payload as { error?: object },
					isError: true
				};
			}

			users.push(getUser.payload.user!);
		}
		return {
			status: 200,
			payload: { users },
			isError: false
		};
	}

	/**
	 * Check if a user exists in Keycloak
	 * @param keycloakConfig
	 * @param username
	 */
	public static async userExists(keycloakConfig: KeycloakConfig, username: string): Promise<ApiCallReturnType<{ exists: boolean }>> {
		const checkAndQueryToken = await this.checkAndQueryToken(keycloakConfig);
		if (checkAndQueryToken.isError) {
			return checkAndQueryToken;
		}

		const res = await fetch(`${keycloakConfig.url}/admin/realms/${keycloakConfig.realm}/users?username=${username}`, {
			method: "GET",
			headers: {
				"Authorization": `Bearer ${this.keycloakToken}`,
				"Content-Type": "application/json"
			}
		});

		if (!res.ok) {
			return formatApiCallError(res);
		}

		const obj = await res.json() as KeycloakUser[];

		return formatApiCallOk(res, { exists: obj.length > 0 });
	}

	/**
	 * Login a user with the Keycloak API
	 * @param keycloakConfig
	 * @param username
	 * @param password
	 */
	public static async loginUser(keycloakConfig: KeycloakConfig, username: string, password: string): Promise<ApiCallReturnType<KeycloakOAuth2Token>> {
		const res = await fetch(`${keycloakConfig.url}/realms/${keycloakConfig.realm}/protocol/openid-connect/token`, {
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded"
			},
			body: new URLSearchParams({
				// Keycloak api naming conventions
				/* eslint-disable camelcase */
				client_id: keycloakConfig.clientId,
				client_secret: keycloakConfig.clientSecret,
				username,
				password,
				grant_type: "password",
				scope: "openid"
				/* eslint-enable camelcase */
			})
		});

		if (!res.ok) {
			return formatApiCallError(res);
		}

		return formatApiCallOk(res, await res.json() as KeycloakOAuth2Token);
	}

	/**
	 * Check if a user has a valid access token
	 * @param keycloakConfig
	 * @param accessToken
	 */
	public static async checkUserAccessToken(keycloakConfig: KeycloakConfig, accessToken: string): Promise<ApiCallReturnType<{ valid: boolean }>> {
		const res = await fetch(`${keycloakConfig.url}/realms/${keycloakConfig.realm}/protocol/openid-connect/token/introspect`, {
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded"
			},
			body: new URLSearchParams({
				// Keycloak api naming conventions
				/* eslint-disable camelcase */
				client_id: keycloakConfig.clientId,
				client_secret: keycloakConfig.clientSecret,
				token: accessToken
				/* eslint-enable camelcase */
			})
		});

		if (!res.ok) {
			return formatApiCallError(res);
		}

		return formatApiCallOk(res, { valid: true });
	}

	/**
	 * Check if a token is valid and get the keycloak ID from it
	 * @param keycloakConfig
	 * @param accessToken
	 */
	public static async checkTokenAndGetKeycloakId(keycloakConfig: KeycloakConfig, accessToken: string): Promise<ApiCallReturnType<{ keycloakId: string }>> {
		const res = await fetch(`${keycloakConfig.url}/realms/${keycloakConfig.realm}/protocol/openid-connect/userinfo`, {
			method: "GET",
			headers: {
				"Authorization": `Bearer ${accessToken}`,
				"Content-Type": "application/json"
			}
		});

		if (!res.ok) {
			return formatApiCallError(res);
		}

		return formatApiCallOk(res, { keycloakId: (await res.json() as { sub: string }).sub });
	}

	/**
	 * Refresh the user token
	 * @param keycloakConfig
	 * @param refreshToken
	 */
	public static async refreshUserToken(keycloakConfig: KeycloakConfig, refreshToken: string): Promise<ApiCallReturnType<KeycloakOAuth2Token>> {
		const res = await fetch(`${keycloakConfig.url}/realms/${keycloakConfig.realm}/protocol/openid-connect/token`, {
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded"
			},
			body: new URLSearchParams({
				// Keycloak api naming conventions
				/* eslint-disable camelcase */
				client_id: keycloakConfig.clientId,
				client_secret: keycloakConfig.clientSecret,
				refresh_token: refreshToken,
				grant_type: "refresh_token"
				/* eslint-enable camelcase */
			})
		});

		if (!res.ok) {
			return formatApiCallError(res);
		}

		return formatApiCallOk(res, await res.json() as KeycloakOAuth2Token);
	}

	/**
	 * Get an access token for user with keycloak ID
	 * @param keycloakConfig
	 * @param keycloakId
	 */
	public static async getUserAccessToken(keycloakConfig: KeycloakConfig, keycloakId: string): Promise<ApiCallReturnType<KeycloakOAuth2Token>> {
		const checkAndQueryToken = await this.checkAndQueryToken(keycloakConfig);
		if (checkAndQueryToken.isError) {
			return checkAndQueryToken;
		}

		const res = await fetch(`${keycloakConfig.url}/realms/${keycloakConfig.realm}/protocol/openid-connect/token`, {
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded"
			},
			body: new URLSearchParams({
				// Keycloak api naming conventions
				/* eslint-disable camelcase */
				client_id: keycloakConfig.clientId,
				client_secret: keycloakConfig.clientSecret,
				grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
				subject_token: this.keycloakToken!,
				subject_token_type: "urn:ietf:params:oauth:token-type:access_token",
				requested_subject: keycloakId,
				scope: "openid"
				/* eslint-enable camelcase */
			})
		});

		if (!res.ok) {
			return formatApiCallError(res);
		}

		return formatApiCallOk(res, await res.json() as KeycloakOAuth2Token);
	}

	// Needed because the return type must be an object
	/* eslint-disable @typescript-eslint/no-empty-object-type */
	private static async checkAndQueryToken(keycloakConfig: KeycloakConfig): Promise<ApiCallReturnType<{}>> {
		if (this.keycloakToken === null || this.keycloakTokenExpirationDate! < Date.now()) {
			const res = await fetch(`${keycloakConfig.url}/realms/${keycloakConfig.realm}/protocol/openid-connect/token`, {
				method: "POST",
				headers: {
					"Content-Type": "application/x-www-form-urlencoded"
				},

				// Keycloak api naming conventions
				/* eslint-disable camelcase */
				body: new URLSearchParams({
					client_id: keycloakConfig.clientId,
					client_secret: keycloakConfig.clientSecret,
					grant_type: "client_credentials"
				})
				/* eslint-enable camelcase */
			});

			if (!res.ok) {
				return formatApiCallError(res);
			}

			const obj = await res.json();
			this.keycloakToken = obj.access_token;
			this.keycloakTokenExpirationDate = Date.now() + obj.expires_in - Math.ceil(0.1 * obj.expires_in); // -10% of seconds to be sure that the token hasn't expired
		}

		return {
			status: 200,
			payload: {},
			isError: false
		};
	}

	// Needed because the return type must be an object
	/* eslint-disable @typescript-eslint/no-empty-object-type */
	private static async updateGameUsername(user: KeycloakUser, newGameUsername: string, keycloakConfig: KeycloakConfig): Promise<ApiCallReturnType<{}>> {
		const checkAndQueryToken = await this.checkAndQueryToken(keycloakConfig);
		if (checkAndQueryToken.isError) {
			return checkAndQueryToken;
		}

		const attributes = user.attributes;
		attributes.gameUsername = [newGameUsername];

		const res = await fetch(`${keycloakConfig.url}/admin/realms/${keycloakConfig.realm}/users/${user.id}`, {
			method: "PUT",
			headers: {
				"Authorization": `Bearer ${this.keycloakToken}`,
				"Content-Type": "application/json"
			},
			body: JSON.stringify({
				attributes
			})
		});

		if (!res.ok) {
			return formatApiCallError(res);
		}

		return formatApiCallOk(res, {});
	}

	/**
	 * Send a get request to keycloak to retrieve a user from it's discordId
	 * @param keycloakConfig
	 * @param discordId
	 */
	private static async getUserFromDiscordId(keycloakConfig: KeycloakConfig, discordId: string): Promise<Response> {
		return await fetch(`${keycloakConfig.url}/admin/realms/${keycloakConfig.realm}/users?q=discordId:${discordId}`, {
			method: "GET",
			headers: {
				"Authorization": `Bearer ${this.keycloakToken}`,
				"Content-Type": "application/json"
			}
		});
	}
}
