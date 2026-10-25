import {
	QueryInterface, QueryTypes
} from "sequelize";
import { MapLinkDataController } from "../../../../data/MapLink";
import { CrowniclesLogger } from "../../../../../../Lib/src/logs/CrowniclesLogger";

/**
 * Build the SQL expression converting a column from the game map link ids to the logs map link ids
 */
function buildConversionCase(column: string, gameToLogsMapLinkIds: Map<number, number>): string {
	const whenClauses = [...gameToLogsMapLinkIds.entries()]
		.map(([gameId, logsId]) => `WHEN ${Number(gameId)} THEN ${Number(logsId)}`)
		.join(" ");
	return `CASE ${column} ${whenClauses} ELSE ${column} END`;
}

/**
 * Convert the map link ids stored in the teleportation logs from the game ids to the logs ids.
 * The teleportations using a game map link that does not exist anymore cannot be converted and are deleted.
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
	const rows = await context.select(null, "players_teleportations") as {
		originMapLinkId: number;
		newMapLinkId: number;
	}[];

	const gameMapLinkIds = [...new Set(rows.flatMap(row => [row.originMapLinkId, row.newMapLinkId]))];

	if (gameMapLinkIds.length === 0) {
		return;
	}

	const knownGameMapLinkIds: number[] = [];
	const unknownGameMapLinkIds: number[] = [];
	for (const gameMapLinkId of gameMapLinkIds) {
		const gameMapLink = MapLinkDataController.instance.getById(gameMapLinkId);
		if (gameMapLink) {
			knownGameMapLinkIds.push(gameMapLinkId);
		}
		else {
			unknownGameMapLinkIds.push(gameMapLinkId);
		}
	}

	if (unknownGameMapLinkIds.length > 0) {
		await context.sequelize.query(
			"DELETE FROM players_teleportations WHERE originMapLinkId IN (:ids) OR newMapLinkId IN (:ids)",
			{
				type: QueryTypes.DELETE,
				replacements: { ids: unknownGameMapLinkIds }
			}
		);
		CrowniclesLogger.warn("Deleted the teleportations using game map links that do not exist anymore", { unknownGameMapLinkIds });
	}

	const gameToLogsMapLinkIds = new Map<number, number>();
	for (const gameMapLinkId of knownGameMapLinkIds) {
		const gameMapLink = MapLinkDataController.instance.getById(gameMapLinkId)!;
		const replacements = {
			start: gameMapLink.startMap,
			end: gameMapLink.endMap
		};
		const selectLogsMapLink = (): Promise<{ id: number }[]> => context.sequelize.query<{ id: number }>(
			"SELECT id FROM map_links WHERE `start` = :start AND `end` = :end LIMIT 1",
			{
				type: QueryTypes.SELECT,
				replacements
			}
		);

		let logsMapLink = await selectLogsMapLink();
		if (logsMapLink.length === 0) {
			await context.sequelize.query(
				"INSERT INTO map_links (`start`, `end`) VALUES (:start, :end)",
				{
					type: QueryTypes.INSERT,
					replacements
				}
			);
			logsMapLink = await selectLogsMapLink();
		}
		gameToLogsMapLinkIds.set(gameMapLinkId, logsMapLink[0].id);
	}

	if (gameToLogsMapLinkIds.size === 0) {
		return;
	}

	await context.sequelize.query(`
		UPDATE players_teleportations
		SET originMapLinkId = ${buildConversionCase("originMapLinkId", gameToLogsMapLinkIds)},
			newMapLinkId = ${buildConversionCase("newMapLinkId", gameToLogsMapLinkIds)}
	`);
}

/**
 * The conversion cannot be reverted: the deleted rows are lost, and the logs ids do not tell which game ids they came from
 */
export async function down(): Promise<void> {
	// Nothing to do
}
