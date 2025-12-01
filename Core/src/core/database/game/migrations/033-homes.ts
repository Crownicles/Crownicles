import {
	DataTypes, QueryInterface
} from "sequelize";
import * as moment from "moment";

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	await context.createTable("homes", {
		id: {
			type: DataTypes.INTEGER,
			primaryKey: true,
			autoIncrement: true
		},
		ownerId: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		cityId: {
			type: DataTypes.STRING,
			allowNull: false
		},
		level: {
			type: DataTypes.INTEGER,
			defaultValue: 1
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
	await context.dropTable("homes");
}
