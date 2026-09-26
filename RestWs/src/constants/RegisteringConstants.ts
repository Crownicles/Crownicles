import { asMinutes } from "../../../Lib/src/types/TimeTypes";
import { minutesToMilliseconds } from "../../../Lib/src/utils/TimeUtils";

export abstract class RegisteringConstants {
	/**
	 * Names the sign-up page must not hand out: `discord-<id>` belongs to the account the bot creates
	 */
	static readonly DISALLOWED_USERNAME_PREFIXES = ["discord-"];

	/**
	 * Names that would pass for the game or its staff, compared with the username Keycloak lowercased
	 */
	static readonly RESERVED_USERNAMES = [
		"crownicles",
		"admin",
		"administrateur",
		"administrator",
		"moderateur",
		"modérateur",
		"moderator",
		"staff",
		"support",
		"system",
		"système"
	];

	/**
	 * How long an account may wait for its address to be confirmed, leaving room for a resent link
	 */
	static readonly UNVERIFIED_ACCOUNT_LIFETIME = minutesToMilliseconds(asMinutes(60));

	static readonly REVIEW_INTERVAL = minutesToMilliseconds(asMinutes(1));

	/**
	 * Registrations read at each review. The realm keeps them a day, and the mail relay caps sign-ups at 300 a day
	 */
	static readonly REGISTER_EVENTS_PER_REVIEW = 1000;

	/**
	 * `register_method` of an account created from the sign-up page, as opposed to a brokered one
	 */
	static readonly FORM_REGISTER_METHOD = "form";
}
