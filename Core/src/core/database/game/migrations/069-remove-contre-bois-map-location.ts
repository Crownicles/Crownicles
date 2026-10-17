import { QueryInterface } from "sequelize";

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	/*
	 * Map location 20 (Plaines du Contre Bois) was unreachable by road but could
	 * still be drawn as a distant expedition destination. It is removed from the
	 * game data, so the expeditions still shown to players are moved to another
	 * plain of the same continent to keep their name translatable. Finished
	 * expeditions are left untouched to keep the history faithful.
	 */
	await context.sequelize.query(`
		UPDATE pet_expeditions
		SET mapLocationId = 12
		WHERE mapLocationId = 20
		  AND status IN ('pending', 'in_progress')
	`);
}

export async function down(): Promise<void> {
	// No rollback: map location 20 no longer exists.
}
