/**
 * Database configuration
 *
 * host The database host
 * port The database port
 * rootUser The root user
 * rootPassword The root user password
 * user The user
 * userPassword The user password
 * databaseName The database name. For example "game" or "notifications"
 * prefix The database prefix used to name the databases. For example, if the prefix is "crownicles_beta" and the database is "game", the database will be named "crownicles_beta_game"
 */
export type DatabaseConfiguration = {
	host: string;
	port: number;
	rootUser: string;
	rootPassword: string;
	user: string;
	userPassword: string;
	databaseName: string;
	prefix: string;
};
