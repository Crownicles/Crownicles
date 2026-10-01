export const KeycloakConstants = {
	IDENTITY_PROVIDERS: { DISCORD: "discord" },
	DISCORD_LINK_ERRORS: {
		NOT_LEGACY: "notLegacyDiscordAccount",
		CONFLICT: "discordIdentityConflict"
	}
} as const;
