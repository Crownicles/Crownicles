export abstract class RegisteringConstants {
	/**
	 * Usernames that start with these prefixes are not allowed
	 */
	static readonly DISALLOWED_USERNAME_PREFIXES = ["discord-"];

	/**
	 * Shape an address must have to be forwarded to Keycloak, which then applies its own validator
	 */
	static readonly EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+\.[^\s@]+$/u;

	/**
	 * Keycloak role that is allowed to log in if the beta login is enabled
	 */
	static readonly BETA_GROUP = "beta";
}
