import {
	FastifyInstance, FastifyRequest
} from "fastify";
import { CrowniclesLogger } from "../../../../Lib/src/logs/CrowniclesLogger";
import { DiscordSsoConfig } from "../../config/DiscordSsoConfig";
import { KeycloakUtils } from "../../../../Lib/src/keycloak/KeycloakUtils";
import { keycloakConfig } from "../../index";
import {
	Language, LANGUAGE
} from "../../../../Lib/src/Language";
import { betaLoginVerifyGroup } from "./LoginRoute";
import { KeycloakUser } from "../../../../Lib/src/keycloak/KeycloakUser";
import { KeycloakOAuth2Token } from "../../../../Lib/src/keycloak/KeycloakOAuth2Token";
import { getRequestLoggerMetadata } from "../RestApi";

/**
 * Fetches the access token from Discord using the provided code.
 * @param req
 * @param discordOptions
 * @param code
 */
async function getDiscordUserAccessToken(req: FastifyRequest, discordOptions: DiscordSsoConfig, code: string): Promise<string | undefined> {
	const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
		method: "POST",
		headers: {
			"Content-Type": "application/x-www-form-urlencoded"
		},

		// Discord naming convention
		/* eslint-disable camelcase */
		body: new URLSearchParams({
			client_id: discordOptions.clientId,
			client_secret: discordOptions.clientSecret,
			grant_type: "authorization_code",
			code,
			redirect_uri: `${discordOptions.callbackUrl}/discord/callback`
		})
		/* eslint-enable camelcase */
	});

	if (!tokenResponse.ok) {
		// It can be someone trying codes manually or a bot, so don't log as error
		CrowniclesLogger.warn("Failed to get access token from Discord", {
			code,
			response: tokenResponse,
			...getRequestLoggerMetadata(req)
		});
		return undefined;
	}

	return (await tokenResponse.json()).access_token;
}

/**
 * Fetches the user information from Discord using the provided access token.
 * @param req
 * @param accessToken
 */
async function getDiscordUserInfo(req: FastifyRequest, accessToken: string): Promise<{
	discordId: string;
	displayName: string;
	language: Language;
} | undefined> {
	const userResponse = await fetch("https://discord.com/api/users/@me", {
		headers: {
			Authorization: `Bearer ${accessToken}`
		}
	});

	if (!userResponse.ok) {
		CrowniclesLogger.error("Failed to get user info from Discord", {
			response: userResponse,
			...getRequestLoggerMetadata(req)
		});
		return undefined;
	}

	const userInfo = await userResponse.json() as {
		id: string; global_name: string; locale: string;
	};

	let language = userInfo.locale.slice(0, 2);
	if (!(LANGUAGE.LANGUAGES as string[]).includes(language)) {
		language = LANGUAGE.DEFAULT_LANGUAGE;
	}

	return {
		discordId: userInfo.id,
		displayName: userInfo.global_name,
		language: language as Language
	};
}

/**
 * Registers the user in Keycloak if they don't exist, or retrieves their information if they do.
 * @param req
 * @param discordId
 * @param displayName
 * @param language
 */
async function getOrRegisterDiscordUser(req: FastifyRequest, discordId: string, displayName: string, language: Language): Promise<KeycloakUser | undefined> {
	const resUser = await KeycloakUtils.getOrRegisterDiscordUser(keycloakConfig, discordId, displayName, language);

	if (resUser.isError) {
		CrowniclesLogger.error("Failed to get or register user", {
			discordId,
			displayName,
			language,
			apiReturn: resUser,
			...getRequestLoggerMetadata(req)
		});
		return undefined;
	}

	return resUser.payload.user;
}

/**
 * Retrieves the Keycloak access token for the user.
 * @param req
 * @param keycloakId
 */
async function getKeycloakToken(req: FastifyRequest, keycloakId: string): Promise<KeycloakOAuth2Token | undefined> {
	const resToken = await KeycloakUtils.getUserAccessToken(keycloakConfig, keycloakId);

	if (resToken.isError) {
		CrowniclesLogger.error("Failed to get Keycloak access token", {
			apiReturn: resToken,
			keycloakId,
			...getRequestLoggerMetadata(req)
		});
		return undefined;
	}

	return resToken.payload;
}

/**
 * Sets up the Discord OAuth2 routes for the application.
 * @param server
 * @param discordOptions
 * @param betaLogin
 */
export function setupDiscordRoutes(server: FastifyInstance, discordOptions: DiscordSsoConfig, betaLogin: boolean): void {
	/**
	 * Redirects the user to the Discord OAuth2 authorization page.
	 */
	server.get("/discord", (_request, reply) =>
		reply.redirect(`https://discord.com/api/oauth2/authorize?client_id=${discordOptions.clientId}&redirect_uri=${encodeURIComponent(`${discordOptions.callbackUrl}/discord/callback`)}&response_type=code&scope=identify`));

	/**
	 * Handles the callback from Discord after the user has authorized the application.
	 */
	server.get("/discord/callback", async (request, reply) => {
		try {
			CrowniclesLogger.debug("Discord OAuth callback", {
				...getRequestLoggerMetadata(request)
			});

			const { code } = request.query as { code: string };

			if (!code) {
				reply.status(400).send({ error: "Code is required" });
				return;
			}

			// Fetches Discord access token
			const discordAccessToken = await getDiscordUserAccessToken(request, discordOptions, code);
			if (!discordAccessToken) {
				reply.status(400).send({ error: "Failed to get Discord access token" });
				return;
			}

			// Fetches user information from Discord
			const discordUserInfo = await getDiscordUserInfo(request, discordAccessToken);
			if (!discordUserInfo) {
				reply.status(500).send({ error: "Failed to get Discord user info" });
				return;
			}

			// Registers the user in Keycloak or retrieves their information
			const keycloakUser = await getOrRegisterDiscordUser(request, discordUserInfo.discordId, discordUserInfo.displayName, discordUserInfo.language);
			if (!keycloakUser) {
				reply.status(500).send({ error: "Failed to get or register user" });
				return;
			}

			// If beta login is enabled, check if the user is in the beta group
			if (betaLogin && !await betaLoginVerifyGroup(request, keycloakUser.id, reply)) {
				return;
			}

			// Get the Keycloak access token for the user and send it in the response
			const keycloakToken = await getKeycloakToken(request, keycloakUser.id);
			CrowniclesLogger.info("User logged in via Discord", {
				...discordUserInfo,
				keycloakId: keycloakUser.id
			});
			reply.redirect(`crownicles://discord?token=${Buffer.from(JSON.stringify(keycloakToken)).toString("base64")}`);
		}
		catch (error) {
			console.error("Error during Discord OAuth callback", error);
			CrowniclesLogger.error("Error during Discord OAuth callback", {
				err: (error as { toString: () => string }).toString ? (error as { toString: () => string }).toString() : error,
				...getRequestLoggerMetadata(request)
			});
			reply.status(500).send({ error: "Internal server error" });
		}
	});
}
