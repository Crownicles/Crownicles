import {
	DataTypes, QueryInterface
} from "sequelize";
import * as moment from "moment";

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	await context.createTable("material", {
		playerId: {
			type: DataTypes.INTEGER,
			primaryKey: true
		},
		materialId: {
			// eslint-disable-next-line new-cap
			type: DataTypes.STRING(16),
			primaryKey: true
		},
		quantity: {
			type: DataTypes.INTEGER,
			defaultValue: 0
		},
		updatedAt: {
			type: DataTypes.DATE,
			defaultValue: moment()
				.format("YYYY-MM-DD HH:mm:ss")
		},
		createdAt: {
			type: DataTypes.DATE,
			defaultValue: moment()
				.format("YYYY-MM-DD HH:mm:ss")
		}
	});
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await context.dropTable("material");
}
