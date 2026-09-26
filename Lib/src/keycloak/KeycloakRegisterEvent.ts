/**
 * Event recorded by Keycloak when an account is created, stored while the realm saves `REGISTER` events
 */
export interface KeycloakRegisterEvent {
	time: number;
	userId: string;
	details?: {
		username?: string;

		// Keycloak naming: "form" when the account comes from the sign-up page
		// eslint-disable-next-line camelcase
		register_method?: string;
	};
}
