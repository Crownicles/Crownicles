import {KeycloakConfig} from "./KeycloakConfig";
import {KeycloakUserToRegister} from "./KeycloakUserToRegister";
import {KeycloakUser} from "./KeycloakUser";
import {Language} from "../Language";

export class KeycloakUtils {
	private static keycloakToken: string | null = null;

	private static keycloakTokenExpirationDate: number | null = null;

	private static keycloakDiscordToIdMap = new Map<string, string>();

	private static async checkAndQueryToken(keycloakConfig: KeycloakConfig): Promise<void> {
		if (this.keycloakToken === null || this.keycloakTokenExpirationDate! < Date.now()) {
			const res = await fetch(`${keycloakConfig.url}/realms/${keycloakConfig.realm}/protocol/openid-connect/token`, {
				method: "POST",
				headers: {
					"Content-Type": "application/x-www-form-urlencoded"
				},
				body: new URLSearchParams({
					"client_id": keycloakConfig.clientId,
					"client_secret": keycloakConfig.clientSecret,
					"grant_type": "client_credentials"
				})
			});

			if (!res.ok) {
				throw new Error(`Keycloak login error: '${JSON.stringify(await res.json())}'`);
			}

			const obj = await res.json();
			this.keycloakToken = obj.access_token;
			this.keycloakTokenExpirationDate = Date.now() + obj.expires_in - Math.ceil(0.1 * obj.expires_in); // -10% of seconds to be sure that the token hasn't expired
		}
	}

	private static async updateGameUsername(user: KeycloakUser, newGameUsername: string, keycloakConfig: KeycloakConfig): Promise<void> {
		await this.checkAndQueryToken(keycloakConfig);

		const attributes = user.attributes;
		attributes.gameUsername = newGameUsername;

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
			throw new Error(`Keycloak update game username for user '${user.id}' tp '${newGameUsername}' error: '${JSON.stringify(await res.json())}'`);
		}
	}

	public static async getUserByKeycloakId(keycloakConfig: KeycloakConfig, keycloakId: string): Promise<KeycloakUser | null> {
		await this.checkAndQueryToken(keycloakConfig);

		const res = await fetch(`${keycloakConfig.url}/admin/realms/${keycloakConfig.realm}/users/${keycloakId}`, {
			method: "GET",
			headers: {
				"Authorization": `Bearer ${this.keycloakToken}`,
				"Content-Type": "application/json"
			}
		});

		if (!res.ok) {
			throw new Error(`Keycloak retrieve user with keycloak ID '${keycloakId}' error: '${JSON.stringify(await res.json())}'`);
		}

		return await res.json() as KeycloakUser;
	}

	public static async getUserIdByUsername(keycloakConfig: KeycloakConfig, username: string): Promise<KeycloakUser | null> {
		await this.checkAndQueryToken(keycloakConfig);

		const res = await fetch(`${keycloakConfig.url}/admin/realms/${keycloakConfig.realm}/users?username=${username}`, {
			method: "GET",
			headers: {
				"Authorization": `Bearer ${this.keycloakToken}`,
				"Content-Type": "application/json"
			}
		});

		if (!res.ok) {
			throw new Error(`Keycloak retrieve user with username '${username}' error: '${JSON.stringify(await res.json())}'`);
		}

		const obj = await res.json() as KeycloakUser[];

		if (obj.length === 0) {
			return null;
		}

		return obj[0];
	}

	public static async registerUser(keycloakConfig: KeycloakConfig, registerParams: KeycloakUserToRegister): Promise<KeycloakUser> {
		await this.checkAndQueryToken(keycloakConfig);

		// Populate attributes
		const attributes: { [key:string]: string[] } = {};
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
				enabled: true
			})
		});

		if (!res.ok) {
			throw new Error(`Keycloak create user with parameters '${JSON.stringify(registerParams)}', error: '${JSON.stringify(await res.json())}'`);
		}

		return (await this.getUserIdByUsername(keycloakConfig, registerParams.keycloakUsername))!;
	}

	public static async getDiscordUser(keycloakConfig: KeycloakConfig, discordId: string, gameUsername: string | null): Promise<KeycloakUser> {
		await this.checkAndQueryToken(keycloakConfig);

		const res = await fetch(`${keycloakConfig.url}/admin/realms/${keycloakConfig.realm}/users?q=discordId:${discordId}`, {
			method: "GET",
			headers: {
				"Authorization": `Bearer ${this.keycloakToken}`,
				"Content-Type": "application/json"
			}
		});

		if (!res.ok) {
			throw new Error(`Keycloak retrieve user with attribute 'discordId:${discordId}', error: '${JSON.stringify(await res.json())}'`);
		}

		const obj = await res.json();
		const user: KeycloakUser = obj.length === 1 ? obj[0] : null;

		if (gameUsername && user.attributes.gameUsername !== gameUsername) {
			await KeycloakUtils.updateGameUsername(user, gameUsername, keycloakConfig);
		}

		KeycloakUtils.keycloakDiscordToIdMap.set(discordId, user.id);

		return user;
	}

	public static async getOrRegisterDiscordUser(keycloakConfig: KeycloakConfig, discordId: string, gameUsername: string, language: string): Promise<KeycloakUser> {
		await this.checkAndQueryToken(keycloakConfig);

		const res = await this.getUserFromDiscordId(keycloakConfig, discordId);

		if (!res.ok) {
			throw new Error(`Keycloak retrieve user with attribute 'discordId:${discordId}', error: '${JSON.stringify(await res.json())}'`);
		}

		const obj = await res.json();
		let user: KeycloakUser;
		if (obj.length === 0) {
			user = await this.registerUser(keycloakConfig, { keycloakUsername: `discord/${discordId}`, gameUsername, discordId, language });
		}
		else {
			user = obj[0] as KeycloakUser;

			if (gameUsername && user.attributes.gameUsername !== gameUsername) {
				await KeycloakUtils.updateGameUsername(user, gameUsername, keycloakConfig);
			}
		}

		KeycloakUtils.keycloakDiscordToIdMap.set(discordId, user.id);

		return user;
	}

	/**
	 * Send a get request to keycloak to retrieve a user from it's discordId
	 * @param keycloakConfig
	 * @param discordId
	 * @private
	 */
	private static async getUserFromDiscordId(keycloakConfig: KeycloakConfig, discordId: string) : Promise<Response> {
		return await fetch(`${keycloakConfig.url}/admin/realms/${keycloakConfig.realm}/users?q=discordId:${discordId}`, {
			method: "GET",
			headers: {
				"Authorization": `Bearer ${this.keycloakToken}`,
				"Content-Type": "application/json"
			}
		});
	}

	public static async getKeycloakIdFromDiscordId(keycloakConfig: KeycloakConfig, discordId: string, gameUsername: string | null): Promise<string | null> {
		const cachedId = KeycloakUtils.keycloakDiscordToIdMap.get(discordId);
		if (cachedId) {
			return cachedId;
		}

		await this.checkAndQueryToken(keycloakConfig);

		const res = await this.getUserFromDiscordId(keycloakConfig, discordId);

		if (!res.ok) {
			throw new Error(`Keycloak retrieve user with attribute 'discordId:${discordId}', error: '${JSON.stringify(await res.json())}'`);
		}

		const obj = await res.json();
		const user = obj.length === 0 ? null : obj[0] as KeycloakUser;
		const id = user?.id ?? null;

		if (user && id) {
			KeycloakUtils.keycloakDiscordToIdMap.set(discordId, id);

			if (gameUsername && user.attributes.gameUsername !== gameUsername) {
				await KeycloakUtils.updateGameUsername(user, gameUsername, keycloakConfig);
			}
		}

		return id;
	}

	public static async updateUserLanguage(keycloakConfig: KeycloakConfig, user: KeycloakUser, newLanguage: Language): Promise<void> {
		await this.checkAndQueryToken(keycloakConfig);

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
			throw new Error(`Keycloak update language for user '${user.id}' to '${newLanguage}' error: '${JSON.stringify(await res.json())}'`);
		}
	}

	/**
	 * Get the language of a user from its attributes
	 * @param user
	 */
	public static getUserLanguage(user: KeycloakUser): Language {
		return user.attributes.language[0];
	}
}