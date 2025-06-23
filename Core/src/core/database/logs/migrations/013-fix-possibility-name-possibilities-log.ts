import { QueryInterface } from "sequelize";

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	await context.sequelize.query(`
		UPDATE possibilities
		SET possibilityName = 'compromise'
		WHERE possibilityName = 'comrpomise'
	`);
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await context.sequelize.query(`
		UPDATE possibilities
		SET possibilityName = 'compromise'
		WHERE possibilityName = 'comrpomise'
	`);
}
