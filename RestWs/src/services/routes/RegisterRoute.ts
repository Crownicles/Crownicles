import { keycloakConfig } from "../../index";
import { RegisteringConstants } from "../../constants/RegisteringConstants";
import { KeycloakUtils } from "../../../../Lib/src/keycloak/KeycloakUtils";
import { LANGUAGE } from "../../../../Lib/src/Language";
import {
	FastifyInstance, FastifyReply, FastifyRequest
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
 * Verifies if the email address is valid.
 * @param email
 * @param reply
 */
function verifyEmail(email: string, reply: FastifyReply): boolean {
	if (!RegisteringConstants.EMAIL_PATTERN.test(email)) {
		reply.status(400).send({ error: "Invalid email address" });
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

type RegisterCredentials = {
	username: string;
	password: string;
	email: string;
};

function hasAllCredentials(credentials: Partial<RegisterCredentials>): credentials is RegisterCredentials {
	return [
		credentials.username,
		credentials.password,
		credentials.email
	].every(value => Boolean(value));
}

async function checkProvidedInformation(
	credentials: {
		username: string | undefined;
		password: string | undefined;
		email: string | undefined;
	},
	language: string | undefined,
	reply: FastifyReply
): Promise<boolean> {
	// Check if the user data is provided
	if (!hasAllCredentials(credentials)) {
		reply.status(400).send({ error: "Username, password and email are required" });
		return false;
	}
	const {
		username, email
	} = credentials;

	// Check if the username is valid
	if (!verifyUsername(username, reply)) {
		return false;
	}

	// Check if the email is valid
	if (!verifyEmail(email, reply)) {
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
 * Sends the address verification mail, and undoes the registration when it cannot be sent.
 *
 * The mail relay has a daily quota. Keeping an account that can never be verified would hold its
 * address hostage, so the player is told to come back later instead.
 * @param keycloakId
 * @param request
 * @param reply
 */
async function sendVerificationOrRollBack(keycloakId: string, request: FastifyRequest, reply: FastifyReply): Promise<boolean> {
	const verification = await KeycloakUtils.sendVerificationEmail(keycloakConfig, keycloakId);
	if (!verification.isError) {
		return true;
	}

	CrowniclesLogger.error("Could not send the verification email, rolling the registration back", {
		apiReturn: verification,
		keycloakId,
		...getRequestLoggerMetadata(request)
	});

	const rollback = await KeycloakUtils.deleteUser(keycloakConfig, keycloakId);
	if (rollback.isError) {
		CrowniclesLogger.error("Rollback of an unverifiable registration failed, the address stays taken", {
			apiReturn: rollback,
			keycloakId,
			...getRequestLoggerMetadata(request)
		});
	}

	reply.status(503).send({ error: "Verification email could not be sent" });
	return false;
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
				username, password, email, language
			} = request.body as {
				username?: string;
				password?: string;
				email?: string;
				language?: string;
			};

			// Check if information provided is valid
			if (!await checkProvidedInformation({
				username, password, email
			}, language, reply)) {
				return;
			}

			// Try to register the user
			const user = await KeycloakUtils.registerUser(keycloakConfig, {
				keycloakUsername: username!,
				gameUsername: username!,
				language: language ?? LANGUAGE.DEFAULT_LANGUAGE,
				email,
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

			if (!await sendVerificationOrRollBack(user.payload.user.id, request, reply)) {
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
