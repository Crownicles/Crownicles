import { KeycloakConfig } from "./KeycloakConfig";
import { KeycloakUserToRegister } from "./KeycloakUserToRegister";
import { KeycloakUser } from "./KeycloakUser";
import { KeycloakRegisterEvent } from "./KeycloakRegisterEvent";
import { KeycloakFederalIdentity } from "./KeycloakFederalIdentity";
import { KeycloakSessionIdentity } from "./KeycloakSessionIdentity";
import { KeycloakConstants } from "../constants/KeycloakConstants";
import {
	Language, LANGUAGE
} from "../Language";

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

export type DiscordIdentityLinkResult = { changed: boolean };

/**
 * Format the response of an API call as an error
 * @param res
 */
async function formatApiCallError<T extends object>(res: Response): Promise<ApiCallReturnType<T>> {
	let payload;
	try {
		payload = await res.json();
	}
	catch {
		payload = {};
	}
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

type DiscordLinkError = typeof KeycloakConstants.DISCORD_LINK_ERRORS[keyof typeof KeycloakConstants.DISCORD_LINK_ERRORS];

function discordLinkError<T extends object>(status: number, reason: DiscordLinkError): ApiCallReturnType<T> {
	return {
		isError: true, status, payload: { error: { reason } }
	};
}

function unchangedLink(status: number): ApiCallReturnType<DiscordIdentityLinkResult> {
	return {
		isError: false, status, payload: { changed: false }
	};
}

function emptyOk(status: number): ApiCallReturnType<Record<string, never>> {
	return {
		isError: false, status, payload: {}
	};
}

function discordIdentityOf(identities: KeycloakFederalIdentity[]): KeycloakFederalIdentity | undefined {
	return identities.find(identity => identity.identityProvider === KeycloakConstants.IDENTITY_PROVIDERS.DISCORD);
}

/**
 * The Discord ID of an account created by the Discord bot before the identity provider existed
 * @param user
 */
function legacyDiscordId(user: KeycloakUser): string | undefined {
	const discordId = user.attributes?.discordId?.[0];
	return discordId && user.username === `discord-${discordId}` ? discordId : undefined;
}

function sameEmail(user: KeycloakUser, email: string): boolean {
	return user.attributes?.discordEmail?.[0]?.trim().toLowerCase() === email.trim().toLowerCase();
}

function registrationBody(registerParams: KeycloakUserToRegister): object {
	const { discordId } = registerParams;
	return {
		username: registerParams.keycloakUsername,
		attributes: {
			language: [registerParams.language],
			gameUsername: [registerParams.gameUsername],
			...discordId ? { discordId: [discordId] } : {}
		},
		enabled: true,
		...discordId
			? {
				federatedIdentities: [
					{
						identityProvider: KeycloakConstants.IDENTITY_PROVIDERS.DISCORD,
						userId: discordId,
						userName: registerParams.keycloakUsername
					}
				]
			}
			: {}
	};
}

export abstract class KeycloakUtils {
	private static keycloakToken: string | null = null;

	private static keycloakTokenExpirationDate: number | null = null;

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

		const res = await fetch(`${keycloakConfig.url}/admin/realms/${keycloakConfig.realm}/users?username=${encodeURIComponent(username)}&exact=true`, {
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
	 * Read a resource of the admin API
	 * @param keycloakConfig
	 * @param path - Path under the realm admin API
	 * @param toPayload - Shape of the payload returned for the response body
	 */
	private static async adminGet<Body, T extends object>(keycloakConfig: KeycloakConfig, path: string, toPayload: (body: Body) => T): Promise<ApiCallReturnType<T>> {
		const token = await this.checkAndQueryToken(keycloakConfig);
		if (token.isError) {
			return token;
		}
		const response = await fetch(`${keycloakConfig.url}/admin/realms/${keycloakConfig.realm}/${path}`, {
			headers: { Authorization: `Bearer ${this.keycloakToken}` }
		});
		if (!response.ok) {
			return formatApiCallError(response);
		}
		return formatApiCallOk(response, toPayload(await response.json() as Body));
	}

	private static searchUsers(keycloakConfig: KeycloakConfig, query: URLSearchParams): Promise<ApiCallReturnType<{ users: KeycloakUser[] }>> {
		return this.adminGet(keycloakConfig, `users?${query}`, (users: KeycloakUser[]) => ({ users }));
	}

	public static getUsersByEmail(keycloakConfig: KeycloakConfig, email: string): Promise<ApiCallReturnType<{ users: KeycloakUser[] }>> {
		return this.searchUsers(keycloakConfig, new URLSearchParams({
			email,
			exact: "true"
		}));
	}

	public static async updateUser(keycloakConfig: KeycloakConfig, user: KeycloakUser): Promise<ApiCallReturnType<Record<string, never>>> {
		const token = await this.checkAndQueryToken(keycloakConfig);
		if (token.isError) {
			return token;
		}
		const response = await fetch(`${keycloakConfig.url}/admin/realms/${keycloakConfig.realm}/users/${user.id}`, {
			method: "PUT",
			headers: {
				"Authorization": `Bearer ${this.keycloakToken}`,
				"Content-Type": "application/json"
			},

			// The whole account goes back: Keycloak erases the address and the names a partial update omits
			body: JSON.stringify(user)
		});
		if (!response.ok) {
			return formatApiCallError(response);
		}
		return formatApiCallOk(response, {});
	}

	public static getUsersByDiscordEmail(keycloakConfig: KeycloakConfig, email: string): Promise<ApiCallReturnType<{ users: KeycloakUser[] }>> {
		return this.adminGet(keycloakConfig, `users?${new URLSearchParams({ q: `discordEmail:${email}` })}`, (users: KeycloakUser[]) => ({ users: users.filter(user => sameEmail(user, email)) }));
	}

	public static async linkDiscordIdentity(keycloakConfig: KeycloakConfig, user: KeycloakUser, discordId: string): Promise<ApiCallReturnType<DiscordIdentityLinkResult>> {
		const owners = await this.getDiscordIdentityOwners(keycloakConfig, discordId);
		if (owners.isError) {
			return owners;
		}
		if (owners.payload.users.some(owner => owner.id !== user.id)) {
			return discordLinkError(409, KeycloakConstants.DISCORD_LINK_ERRORS.CONFLICT);
		}
		const identities = await this.getFederatedIdentities(keycloakConfig, user.id);
		if (identities.isError) {
			return identities;
		}
		const existing = discordIdentityOf(identities.payload.identities);
		if (!existing) {
			return this.createDiscordIdentity(keycloakConfig, user, discordId);
		}
		return existing.userId === discordId
			? unchangedLink(identities.status)
			: discordLinkError(409, KeycloakConstants.DISCORD_LINK_ERRORS.CONFLICT);
	}

	/**
	 * Refuse to register a Discord account whose identity already has an owner
	 * @param keycloakConfig
	 * @param discordId
	 */
	private static async ensureDiscordIdentityFree(keycloakConfig: KeycloakConfig, discordId: string | undefined): Promise<ApiCallReturnType<Record<string, never>>> {
		if (!discordId) {
			return emptyOk(200);
		}
		const owners = await this.getDiscordIdentityOwners(keycloakConfig, discordId);
		if (owners.isError) {
			return owners;
		}
		return owners.payload.users.length > 0
			? discordLinkError(409, KeycloakConstants.DISCORD_LINK_ERRORS.CONFLICT)
			: emptyOk(owners.status);
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
		const identityFree = await this.ensureDiscordIdentityFree(keycloakConfig, registerParams.discordId);
		if (identityFree.isError) {
			return identityFree;
		}

		const res = await fetch(`${keycloakConfig.url}/admin/realms/${keycloakConfig.realm}/users`, {
			method: "POST",
			headers: {
				"Authorization": `Bearer ${this.keycloakToken}`,
				"Content-Type": "application/json"
			},
			body: JSON.stringify(registrationBody(registerParams))
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

	public static getUsersPage(keycloakConfig: KeycloakConfig, first: number, max: number): Promise<ApiCallReturnType<{ users: KeycloakUser[] }>> {
		return this.searchUsers(keycloakConfig, new URLSearchParams({
			first: String(first), max: String(max)
		}));
	}

	public static getFederatedIdentities(keycloakConfig: KeycloakConfig, userId: string): Promise<ApiCallReturnType<{ identities: KeycloakFederalIdentity[] }>> {
		return this.adminGet(keycloakConfig, `users/${userId}/federated-identity`, (identities: KeycloakFederalIdentity[]) => ({ identities }));
	}

	public static linkLegacyDiscordUser(keycloakConfig: KeycloakConfig, user: KeycloakUser): Promise<ApiCallReturnType<DiscordIdentityLinkResult>> {
		const discordId = legacyDiscordId(user);
		if (!discordId) {
			return Promise.resolve(discordLinkError(400, KeycloakConstants.DISCORD_LINK_ERRORS.NOT_LEGACY));
		}
		return this.linkDiscordIdentity(keycloakConfig, user, discordId);
	}

	public static getDiscordIdentityOwners(keycloakConfig: KeycloakConfig, discordId: string): Promise<ApiCallReturnType<{ users: KeycloakUser[] }>> {
		return this.searchUsers(keycloakConfig, new URLSearchParams({
			idpAlias: KeycloakConstants.IDENTITY_PROVIDERS.DISCORD, idpUserId: discordId
		}));
	}

	/**
	 * The Discord ID a fresh read of the account links to, if it could be read
	 * @param keycloakConfig
	 * @param user
	 */
	private static async reloadedDiscordId(keycloakConfig: KeycloakConfig, user: KeycloakUser): Promise<string | undefined> {
		const reloaded = await this.getFederatedIdentities(keycloakConfig, user.id);
		return reloaded.isError ? undefined : discordIdentityOf(reloaded.payload.identities)?.userId;
	}

	private static async createDiscordIdentity(keycloakConfig: KeycloakConfig, user: KeycloakUser, discordId: string): Promise<ApiCallReturnType<DiscordIdentityLinkResult>> {
		const response = await fetch(`${keycloakConfig.url}/admin/realms/${keycloakConfig.realm}/users/${user.id}/federated-identity/${KeycloakConstants.IDENTITY_PROVIDERS.DISCORD}`, {
			method: "POST",
			headers: {
				"Authorization": `Bearer ${this.keycloakToken}`,
				"Content-Type": "application/json"
			},
			body: JSON.stringify({
				identityProvider: KeycloakConstants.IDENTITY_PROVIDERS.DISCORD, userId: discordId, userName: user.username
			})
		});
		if (response.ok) {
			return formatApiCallOk(response, { changed: true });
		}

		// A concurrent request may have created the very same link first
		if (response.status === 409 && await this.reloadedDiscordId(keycloakConfig, user) === discordId) {
			return unchangedLink(200);
		}
		return formatApiCallError(response);
	}

	/**
	 * Get the most recent account creations, as long as the realm keeps its `REGISTER` events
	 * @param keycloakConfig
	 * @param max
	 */
	public static async getRegisterEvents(keycloakConfig: KeycloakConfig, max: number): Promise<ApiCallReturnType<{ events: KeycloakRegisterEvent[] }>> {
		const checkAndQueryToken = await this.checkAndQueryToken(keycloakConfig);
		if (checkAndQueryToken.isError) {
			return checkAndQueryToken;
		}

		const res = await fetch(`${keycloakConfig.url}/admin/realms/${keycloakConfig.realm}/events?type=REGISTER&first=0&max=${max}`, {
			method: "GET",
			headers: {
				"Authorization": `Bearer ${this.keycloakToken}`,
				"Content-Type": "application/json"
			}
		});

		if (!res.ok) {
			return formatApiCallError(res);
		}

		return formatApiCallOk(res, { events: await res.json() as KeycloakRegisterEvent[] });
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
			user = (registerUser.payload as { user: KeycloakUser }).user;
		}
		else {
			user = obj[0] as KeycloakUser;

			if (gameUsername && user.attributes.gameUsername[0] !== gameUsername) {
				await KeycloakUtils.updateGameUsername(user, gameUsername, keycloakConfig);
			}
		}


		return formatApiCallOk(res, { user });
	}

	/**
	 * Get the keycloak ID from a discord ID
	 * @param keycloakConfig
	 * @param discordId
	 * @param gameUsername
	 */
	public static async getKeycloakIdFromDiscordId(keycloakConfig: KeycloakConfig, discordId: string, gameUsername: string | null): Promise<ApiCallReturnType<{ keycloakId?: string }>> {
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
			if (gameUsername && user.attributes.gameUsername[0] !== gameUsername) {
				await KeycloakUtils.updateGameUsername(user, gameUsername, keycloakConfig);
			}
		}

		return formatApiCallOk(res, { keycloakId: id });
	}

	/**
	 * Update the language of a user
	 */
	public static async updateUserLanguage(keycloakConfig: KeycloakConfig, user: KeycloakUser, newLanguage: Language): Promise<ApiCallReturnType<Record<string, never>>> {
		const checkAndQueryToken = await this.checkAndQueryToken(keycloakConfig);
		if (checkAndQueryToken.isError) {
			return checkAndQueryToken;
		}
		user.attributes.language = [newLanguage];
		return this.updateUser(keycloakConfig, user);
	}

	/**
	 * Get the language of a user from its attributes
	 *
	 * Accounts created through the Discord identity provider have no language attribute:
	 * only discordId and gameUsername are mapped when the account is federated.
	 * @param user
	 */
	public static getUserLanguage(user: KeycloakUser): Language {
		return user.attributes.language?.[0] ?? LANGUAGE.DEFAULT_LANGUAGE;
	}

	/**
	 * Get multiple users from their keycloak IDs
	 * @param keycloakConfig
	 * @param keycloakIds
	 */
	// TODO Wait for https://github.com/keycloak/keycloak/pull/34582 to be merged and released to use the bulk endpoint
	public static async getUsersFromIds(keycloakConfig: KeycloakConfig, keycloakIds: string[]): Promise<ApiCallReturnType<{ users: (KeycloakUser | null)[] }>> {
		const checkAndQueryToken = await this.checkAndQueryToken(keycloakConfig);
		if (checkAndQueryToken.isError) {
			return checkAndQueryToken;
		}

		const users = await Promise.all(keycloakIds.map(async keycloakId => {
			const getUser = await KeycloakUtils.getUserByKeycloakId(keycloakConfig, keycloakId);
			if (getUser.isError || !("user" in getUser.payload)) {
				return null;
			}
			return getUser.payload.user!;
		}));
		return {
			status: 200,
			payload: { users },
			isError: false
		};
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

	public static async getSessionIdentity(keycloakConfig: KeycloakConfig, accessToken: string): Promise<ApiCallReturnType<{ identity: KeycloakSessionIdentity }>> {
		const response = await fetch(`${keycloakConfig.url}/realms/${keycloakConfig.realm}/protocol/openid-connect/userinfo`, {
			headers: { Authorization: `Bearer ${accessToken}` }
		});
		if (!response.ok) {
			return formatApiCallError(response);
		}
		const identity = await response.json() as KeycloakSessionIdentity;
		if (typeof identity.sub !== "string" || !identity.sub) {
			return {
				isError: true, status: 401, payload: {}
			};
		}
		return formatApiCallOk(response, { identity });
	}

	private static async checkAndQueryToken(keycloakConfig: KeycloakConfig): Promise<ApiCallReturnType<Record<string, never>>> {
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

	/**
	 * Replace the name shown in game, keeping the other attributes of the account
	 * @param user
	 * @param newGameUsername
	 * @param keycloakConfig
	 */
	public static async updateGameUsername(user: KeycloakUser, newGameUsername: string, keycloakConfig: KeycloakConfig): Promise<ApiCallReturnType<Record<string, never>>> {
		const checkAndQueryToken = await this.checkAndQueryToken(keycloakConfig);
		if (checkAndQueryToken.isError) {
			return checkAndQueryToken;
		}

		// An account created from the sign-up page carries no attribute at all until it gets one
		user.attributes = {
			...user.attributes,
			gameUsername: [newGameUsername]
		};

		const res = await fetch(`${keycloakConfig.url}/admin/realms/${keycloakConfig.realm}/users/${user.id}`, {
			method: "PUT",
			headers: {
				"Authorization": `Bearer ${this.keycloakToken}`,
				"Content-Type": "application/json"
			},

			// The whole account goes back: Keycloak erases the address and the names a partial update omits
			body: JSON.stringify(user)
		});

		if (!res.ok) {
			return formatApiCallError(res);
		}

		return formatApiCallOk(res, {});
	}

	/**
	 * Delete a Keycloak user completely (for account deletion / GDPR compliance).
	 *
	 * This method removes the authentication account from Keycloak but does not delete
	 * or modify any game data stored in Crownicles databases. Game data such as pet names,
	 * guild names, and guild descriptions are intentionally preserved as they were voluntarily
	 * entered by the user in free-text fields. Under GDPR, such user-generated content in
	 * non-required fields is not subject to automatic deletion. The player's character will
	 * continue to appear in leaderboards under an anonymized name ("Pseudo 404").
	 *
	 * @param keycloakConfig - Keycloak realm configuration to use for the deletion request.
	 * @param keycloakId - ID of the user to delete in Keycloak.
	 */
	public static async deleteUser(keycloakConfig: KeycloakConfig, keycloakId: string): Promise<ApiCallReturnType<Record<string, never>>> {
		const checkAndQueryToken = await this.checkAndQueryToken(keycloakConfig);
		if (checkAndQueryToken.isError) {
			return {
				...checkAndQueryToken,
				payload: { error: {
					details: "Token check failed", original: checkAndQueryToken.payload
				} }
			};
		}

		// Clear the cache before deleting
		this.keycloakUserGroupsMap.delete(keycloakId);

		// Delete the user from Keycloak
		const res = await fetch(`${keycloakConfig.url}/admin/realms/${keycloakConfig.realm}/users/${keycloakId}`, {
			method: "DELETE",
			headers: {
				"Authorization": `Bearer ${this.keycloakToken}`,
				"Content-Type": "application/json"
			}
		});

		if (!res.ok) {
			const errorBody = await this.safeReadResponseBody(res);
			return {
				status: res.status,
				payload: { error: {
					details: `Keycloak DELETE failed: ${res.status} ${res.statusText}`, body: errorBody
				} },
				isError: true
			};
		}

		return formatApiCallOk(res, {});
	}

	/**
	 * Safely read response body for error logging
	 */
	private static async safeReadResponseBody(res: Response): Promise<string> {
		try {
			return await res.text();
		}
		catch {
			return "Could not read error body";
		}
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
