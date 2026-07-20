import {
	DataTypes, QueryInterface
} from "sequelize";

const PVE_PROGRESSION_INDEX = "idx_pve_player_monster_class";

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	await context.addColumn("pve_fights_results", "classId", {
		type: DataTypes.TINYINT.UNSIGNED,
		allowNull: true
	});
	await context.sequelize.query(`
		UPDATE pve_fights_results pve
		INNER JOIN (
			SELECT actionUsed.pveFightId, MIN(action.classId) AS classId
			FROM pve_fights_actions_used actionUsed
			INNER JOIN fights_actions action ON action.id = actionUsed.actionId
			WHERE action.classId IS NOT NULL
			GROUP BY actionUsed.pveFightId
			HAVING COUNT(DISTINCT action.classId) = 1
		) fightClass ON fightClass.pveFightId = pve.id
		SET pve.classId = fightClass.classId
	`);
	await context.addIndex("pve_fights_results", [
		"playerId",
		"monsterId",
		"classId"
	], { name: PVE_PROGRESSION_INDEX });
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await context.removeIndex("pve_fights_results", PVE_PROGRESSION_INDEX);
	await context.removeColumn("pve_fights_results", "classId");
}
