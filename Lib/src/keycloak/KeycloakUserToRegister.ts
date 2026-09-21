export interface KeycloakUserToRegister {
	keycloakUsername: string;
	gameUsername: string;
	language: string;
	email?: string;
	password?: string;
	discordId?: string;
}
