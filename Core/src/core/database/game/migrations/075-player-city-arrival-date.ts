import {
	DataTypes, QueryInterface
} from "sequelize";

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	await context.addColumn("players", "cityArrivalDate", {
		type: DataTypes.DATE,
		allowNull: true,
		defaultValue: null
	});

	// Players already stationary in a city start earning their stay points from the deployment
	await context.sequelize.query("UPDATE players SET cityArrivalDate = NOW() WHERE insideCity = 1");
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await context.removeColumn("players", "cityArrivalDate");
}
