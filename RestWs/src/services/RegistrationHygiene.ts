import { keycloakConfig } from "../index";
import { RegisteringConstants } from "../constants/RegisteringConstants";
import { KeycloakUtils } from "../../../Lib/src/keycloak/KeycloakUtils";
import { KeycloakUser } from "../../../Lib/src/keycloak/KeycloakUser";
import { KeycloakRegisterEvent } from "../../../Lib/src/keycloak/KeycloakRegisterEvent";
import {
	asMilliseconds, Millisecond, msDiff, nowMs
} from "../../../Lib/src/types/TimeTypes";
import { CrowniclesLogger } from "../../../Lib/src/logs/CrowniclesLogger";

export const REGISTRATION_VERDICTS = {
	DELETE: "delete",
	FIX_GAME_USERNAME: "fixGameUsername",
	WAIT: "wait",
	SETTLED: "settled"
} as const;

export type RegistrationVerdict = typeof REGISTRATION_VERDICTS[keyof typeof REGISTRATION_VERDICTS];

function isForbiddenUsername(username: string): boolean {
	return RegisteringConstants.DISALLOWED_USERNAME_PREFIXES.some(prefix => username.startsWith(prefix))
		|| RegisteringConstants.RESERVED_USERNAMES.includes(username);
}

/**
 * Keycloak lowercases the username, the registration event keeps the case the player typed
 */
export function typedUsername(event: KeycloakRegisterEvent, user: KeycloakUser): string {
	const typed = event.details?.username;
	return typed?.toLowerCase() === user.username ? typed : user.username;
}

/**
 * Decide what an account created from the sign-up page still needs
 * @param event
 * @param user
 * @param now
 */
export function judgeRegistration(event: KeycloakRegisterEvent, user: KeycloakUser, now: Millisecond): RegistrationVerdict {
	if (isForbiddenUsername(user.username)) {
		return REGISTRATION_VERDICTS.DELETE;
	}
	if (!user.emailVerified && msDiff(now, asMilliseconds(event.time)) > RegisteringConstants.UNVERIFIED_ACCOUNT_LIFETIME) {
		return REGISTRATION_VERDICTS.DELETE;
	}
	if (user.attributes?.gameUsername?.[0] !== typedUsername(event, user)) {
		return REGISTRATION_VERDICTS.FIX_GAME_USERNAME;
	}
	return user.emailVerified ? REGISTRATION_VERDICTS.SETTLED : REGISTRATION_VERDICTS.WAIT;
}

/**
 * Reviews the accounts created from Keycloak's sign-up page, which offers no hook of its own: it
 * names them in game, and frees the names reserved to the bot and the staff as well as the
 * addresses nobody confirmed
 */
export abstract class RegistrationHygiene {
	private static readonly settledUserIds = new Set<string>();

	static start(): void {
		setInterval(() => {
			RegistrationHygiene.review(nowMs()).catch(error => {
				CrowniclesLogger.errorWithObj("Registration review failed", error);
			});
		}, RegisteringConstants.REVIEW_INTERVAL);
	}

	static async review(now: Millisecond): Promise<void> {
		const getEvents = await KeycloakUtils.getRegisterEvents(keycloakConfig, RegisteringConstants.REGISTER_EVENTS_PER_REVIEW);
		if (getEvents.isError) {
			CrowniclesLogger.error("Could not read the registration events", { apiReturn: getEvents });
			return;
		}

		const formEvents = getEvents.payload.events.filter(event => event.details?.register_method === RegisteringConstants.FORM_REGISTER_METHOD);
		const reviewedIds = new Set(formEvents.map(event => event.userId));
		for (const userId of RegistrationHygiene.settledUserIds) {
			if (!reviewedIds.has(userId)) {
				RegistrationHygiene.settledUserIds.delete(userId);
			}
		}

		for (const event of formEvents) {
			if (!RegistrationHygiene.settledUserIds.has(event.userId)) {
				await RegistrationHygiene.reviewAccount(event, now);
			}
		}
	}

	private static async reviewAccount(event: KeycloakRegisterEvent, now: Millisecond): Promise<void> {
		const getUser = await KeycloakUtils.getUserByKeycloakId(keycloakConfig, event.userId);
		if (getUser.isError) {
			if (getUser.status === 404) {
				RegistrationHygiene.settledUserIds.add(event.userId);
			}
			else {
				CrowniclesLogger.error("Could not read a registered account", {
					apiReturn: getUser, keycloakId: event.userId
				});
			}
			return;
		}

		const user = getUser.payload.user;
		switch (judgeRegistration(event, user, now)) {
			case REGISTRATION_VERDICTS.DELETE:
				await RegistrationHygiene.deleteAccount(user);
				break;
			case REGISTRATION_VERDICTS.FIX_GAME_USERNAME:
				await RegistrationHygiene.setGameUsername(user, typedUsername(event, user));
				break;
			case REGISTRATION_VERDICTS.SETTLED:
				RegistrationHygiene.settledUserIds.add(user.id);
				break;
			default:
				break;
		}
	}

	private static async deleteAccount(user: KeycloakUser): Promise<void> {
		const deletion = await KeycloakUtils.deleteUser(keycloakConfig, user.id);
		if (deletion.isError) {
			CrowniclesLogger.error("Could not delete a registered account", {
				apiReturn: deletion, keycloakId: user.id
			});
			return;
		}
		RegistrationHygiene.settledUserIds.add(user.id);
		CrowniclesLogger.info("Registered account deleted", {
			keycloakId: user.id, username: user.username, emailVerified: user.emailVerified
		});
	}

	private static async setGameUsername(user: KeycloakUser, gameUsername: string): Promise<void> {
		const update = await KeycloakUtils.updateGameUsername(user, gameUsername, keycloakConfig);
		if (update.isError) {
			CrowniclesLogger.error("Could not set the game username of a registered account", {
				apiReturn: update, keycloakId: user.id
			});
		}
	}
}
