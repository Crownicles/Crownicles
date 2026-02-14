export abstract class DiscordConstants {
	static MAX_BUTTONS_PER_ROW = 5;

	static MAX_SELECT_MENU_OPTIONS = 25;

	static COMMAND_TIMEOUT_MS = 3000;

	static MQTT = {
		SHARD_CONNECTION_MSG: "connected:",
		SHARD_DUPLICATED_MSG: "shardDuplicated:"
	};

	static EMPTY_MESSAGE = "_ _";

	/**
	 * Discord.js cache configuration for RAM optimization
	 */
	static CACHE = {
		/**
		 * Maximum messages cached per channel
		 */
		MESSAGE_LIMIT: 50,

		/**
		 * Maximum guild members to cache
		 */
		GUILD_MEMBER_LIMIT: 500,

		/**
		 * Maximum reactions cached per message
		 */
		REACTION_LIMIT: 50,

		/**
		 * Maximum threads cached per guild
		 */
		THREAD_LIMIT: 50,

		/**
		 * Interval in seconds for sweeping old messages
		 */
		MESSAGE_SWEEP_INTERVAL: 300,

		/**
		 * Lifetime in seconds for cached messages before sweep
		 */
		MESSAGE_LIFETIME: 600,

		/**
		 * Interval in seconds for sweeping guild members
		 */
		GUILD_MEMBER_SWEEP_INTERVAL: 600
	};

	/**
	 * Account deletion related constants
	 */
	static ACCOUNT_DELETION = {
		/**
		 * Default fallback secret when no deletion_secret is configured in config.toml
		 * For production, it is highly recommended to set a unique deletion_secret in config.toml
		 */
		DEFAULT_SECRET: "c7a9f3e8b2d4156890abcdef12345678fedcba0987654321a1b2c3d4e5f60789",

		/**
		 * Minimum length for a secure deletion secret (64 hex chars = 32 bytes)
		 */
		MIN_SECRET_LENGTH: 64,

		/**
		 * Length of the deletion code in hexadecimal characters
		 */
		CODE_LENGTH: 16,

		/**
		 * Maximum allowed failed attempts before temporary block
		 */
		MAX_FAILED_ATTEMPTS: 15,

		/**
		 * Time in milliseconds to block after too many failed attempts (15 minutes)
		 */
		RATE_LIMIT_DURATION_MS: 15 * 60 * 1000,

		/**
		 * Time in milliseconds for how long a deletion confirmation is valid (5 minutes)
		 */
		CONFIRMATION_TIMEOUT_MS: 5 * 60 * 1000,

		/**
		 * The confirmation phrases that users must type to confirm account deletion
		 * Key is the language code, value is the exact phrase to type
		 */
		CONFIRMATION_PHRASES: {
			fr: "CONFIRMER QUE JE SOUHAITE SUPPRIMER MON COMPTE ET QUE JE NE POURRAI PAS LE RÉCUPÉRER",
			en: "CONFIRM THAT I WANT TO DELETE MY ACCOUNT AND THAT I WILL NOT BE ABLE TO RECOVER IT",
			es: "CONFIRMAR QUE DESEO ELIMINAR MI CUENTA Y QUE NO PODRÉ RECUPERARLA",
			de: "BESTÄTIGEN DASS ICH MEIN KONTO LÖSCHEN MÖCHTE UND DASS ICH ES NICHT WIEDERHERSTELLEN KANN",
			it: "CONFERMARE CHE DESIDERO ELIMINARE IL MIO ACCOUNT E CHE NON POTRÒ RECUPERARLO",
			pt: "CONFIRMAR QUE DESEJO EXCLUIR MINHA CONTA E QUE NÃO PODEREI RECUPERÁ-LA"
		} as Record<string, string>
	};

	/**
	 * GDPR export related constants
	 */
	static GDPR_EXPORT = {
		/**
		 * Maximum allowed size for the GDPR export ZIP file in MB
		 * Discord's upload limit is 25MB, we use 20MB to be safe
		 */
		MAX_FILE_SIZE_MB: 20,

		/**
		 * Compression level for the ZIP archive (0-9, where 9 is maximum compression)
		 */
		ZIP_COMPRESSION_LEVEL: 9,

		/**
		 * Number of bytes in a megabyte (used for size calculations)
		 */
		BYTES_PER_MB: 1024 * 1024
	};

	/**
	 * Discord embed field limits
	 */
	static EMBED = {
		/**
		 * Maximum length of an embed field value (Discord limit)
		 */
		FIELD_VALUE_MAX_LENGTH: 1024,

		/**
		 * Zero-width space used as an empty field name in embeds.
		 * Discord rejects truly empty field names, so this invisible character is used instead.
		 */
		EMPTY_FIELD_NAME: "\u200B"
	};

	/**
	 * Numbered emoji buttons for selection interfaces (1️⃣ to 9️⃣)
	 */
	static readonly CHOICE_EMOTES = [
		"1⃣",
		"2⃣",
		"3⃣",
		"4⃣",
		"5⃣",
		"6⃣",
		"7⃣",
		"8⃣",
		"9⃣"
	] as const;
}
