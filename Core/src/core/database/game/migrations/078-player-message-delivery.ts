import {
	DataTypes, QueryInterface
} from "sequelize";
import moment from "moment";

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	await context.createTable("player_message_deliveries", {
		playerId: {
			type: DataTypes.INTEGER,
			primaryKey: true,
			allowNull: false
		},
		destinationLocationId: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		secretEmoji: {
			type: DataTypes.STRING,
			allowNull: false
		},
		updatedAt: {
			type: DataTypes.DATE,
			defaultValue: moment().format("YYYY-MM-DD HH:mm:ss")
		},
		createdAt: {
			type: DataTypes.DATE,
			defaultValue: moment().format("YYYY-MM-DD HH:mm:ss")
		}
	});
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await context.dropTable("player_message_deliveries");
}
