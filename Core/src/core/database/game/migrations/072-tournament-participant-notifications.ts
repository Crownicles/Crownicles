import {
	DataTypes, QueryInterface
} from "sequelize";

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	await context.addColumn("tournaments", "cancellationReason", {
		// eslint-disable-next-line new-cap
		type: DataTypes.STRING(64),
		allowNull: true
	});
	await context.addColumn("tournament_participants", "startedNotificationSent", {
		type: DataTypes.BOOLEAN,
		allowNull: false,
		defaultValue: false
	});
	await context.addColumn("tournament_participants", "endingNotificationSent", {
		type: DataTypes.BOOLEAN,
		allowNull: false,
		defaultValue: false
	});
	await context.addColumn("tournament_participants", "endedNotificationSent", {
		type: DataTypes.BOOLEAN,
		allowNull: false,
		defaultValue: false
	});
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await context.removeColumn("tournament_participants", "endedNotificationSent");
	await context.removeColumn("tournament_participants", "endingNotificationSent");
	await context.removeColumn("tournament_participants", "startedNotificationSent");
	await context.removeColumn("tournaments", "cancellationReason");
}
