import {
	DataTypes, QueryInterface
} from "sequelize";

/** Frozen here rather than read from Lib, so the migration keeps its meaning if the contest week changes. */
const LETTERS_OF_THE_CONTEST_WEEK = 7;

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	await context.addColumn("player_missions_info", "royalLettersReceived", {
		type: DataTypes.TINYINT.UNSIGNED,
		allowNull: false,
		defaultValue: 0
	});
	await context.addColumn("player_missions_info", "lastRoyalLetterAt", {
		type: DataTypes.DATE,
		allowNull: true,
		defaultValue: null
	});

	// The royal mail welcomes newcomers only: everyone already in the kingdom has read the whole week.
	await context.sequelize.query(`UPDATE player_missions_info SET royalLettersReceived = ${LETTERS_OF_THE_CONTEST_WEEK}`);
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await context.removeColumn("player_missions_info", "lastRoyalLetterAt");
	await context.removeColumn("player_missions_info", "royalLettersReceived");
}
