import { QueryInterface } from "sequelize";

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	await context.sequelize.query(`
		UPDATE mission_slots ms
		SET ms.missionId = 'buyApartments',
		    ms.missionObjective = 5,
		    ms.numberDone = LEAST(5, (
		        SELECT COUNT(*)
		        FROM apartments a
		        WHERE a.ownerId = ms.playerId
		    ))
		WHERE ms.missionId = 'buyAllApartments'
		  AND ms.expiresAt IS NULL
	`);
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await context.sequelize.query(`
		UPDATE mission_slots
		SET missionId = 'buyAllApartments',
		    missionObjective = 1,
		    numberDone = 0
		WHERE missionId = 'buyApartments'
		  AND expiresAt IS NULL
	`);
}
