import { keycloakConfig } from "../../index";
import { RegisteringConstants } from "../../constants/RegisteringConstants";
import { KeycloakUtils } from "../../../../Lib/src/keycloak/KeycloakUtils";
import { LANGUAGE } from "../../../../Lib/src/Language";
import {
	FastifyInstance, FastifyReply
} from "fastify";
import { CrowniclesLogger } from "../../../../Lib/src/logs/CrowniclesLogger";
import { getRequestLoggerMetadata } from "../RestApi";

/**
 * Verifies if the username is valid.
 * @param username
 * @param reply
 */
function verifyUsername(username: string, reply: FastifyReply): boolean {
	// Check if the username starts with a disallowed prefix
	if (RegisteringConstants.DISALLOWED_USERNAME_PREFIXES.some(prefix => username.startsWith(prefix))) {
		reply.status(400).send({ error: "Username cannot start with a disallowed prefix" });
		return false;
	}

	return true;
}

/**
 * Verifies if the language is valid.
 * @param language
 * @param reply
 */
function verifyLanguage(language: string, reply: FastifyReply): boolean {
	// Check if the language is valid
	if (!(LANGUAGE.LANGUAGES as string[]).includes(language)) {
		reply.status(400).send({ error: "Invalid language" });
		return false;
	}

	return true;
}

/**
 * Verifies if the user does not already exist.
 * @param username
 * @param reply
 */
async function verifyUserDoesNotExist(username: string, reply: FastifyReply): Promise<boolean> {
	// Check if the user already exists
	const res = await KeycloakUtils.userExists(keycloakConfig, username);
	if (res.isError) {
		reply.status(res.status).send(res.payload);
		return false;
	}

	if (res.payload.exists) {
		reply.status(409).send({ error: "Username already exists" });
		return false;
	}

	return true;
}

async function checkProvidedInformation(
	username: string | undefined,
	password: string | undefined,
	language: string | undefined,
	reply: FastifyReply
): Promise<boolean> {
	// Check if the user data is provided
	if (!username || !password) {
		reply.status(400).send({ error: "Username and password are required" });
		return false;
	}

	// Check if the username is valid
	if (!verifyUsername(username, reply)) {
		return false;
	}

	// Check if the language is valid
	if (language && !verifyLanguage(language, reply)) {
		return false;
	}

	// Check if the user already exists
	return await verifyUserDoesNotExist(username, reply);
}

/**
 * Sets up the registration route for the API.
 * @param server
 * @param allowNewUsersRegistering
 */
export function setupRegisterRoute(server: FastifyInstance, allowNewUsersRegistering: boolean): void {
	server.post("/register", async (request, reply) => {
		try {
			CrowniclesLogger.debug("Register request received", {
				...getRequestLoggerMetadata(request)
			});

			// Check if user registration is allowed
			if (!allowNewUsersRegistering) {
				reply.status(403).send({ error: "User registration is disabled" });
				return;
			}

			// Extract user data from the request body
			const {
				username, password, language
			} = request.body as {
				username?: string;
				password?: string;
				language?: string;
			};

			// Check if information provided is valid
			if (!await checkProvidedInformation(username, password, language, reply)) {
				return;
			}

			// Try to register the user
			const user = await KeycloakUtils.registerUser(keycloakConfig, {
				keycloakUsername: username!,
				gameUsername: username!,
				language: language ?? LANGUAGE.DEFAULT_LANGUAGE,
				password
			});

			// Check if the registration has failed
			if (user.isError) {
				// Log only if the error is not a bad request
				if (user.status !== 400) {
					CrowniclesLogger.error("Failed to register user", {
						apiReturn: user,
						username,
						...getRequestLoggerMetadata(request)
					});
				}
				reply.status(user.status).send(user.payload);
				return;
			}

			// The registration was successful
			CrowniclesLogger.info("User registered successfully", {
				apiReturn: user,
				username
			});
			reply.send({ message: "User registered successfully" });
		}
		catch (error) {
			CrowniclesLogger.errorWithObj("Error during user registration", {
				error,
				...getRequestLoggerMetadata(request)
			});
			reply.status(500).send({ error: "Internal server error" });
		}
	});
}
