/* eslint-disable new-cap */
import {
	DataTypes, QueryInterface
} from "sequelize";

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	await context.createTable("scrap_dealer_recycles", {
		playerId: {
			type: DataTypes.INTEGER,
			allowNull: false,
			references: {
				model: "players",
				key: "id"
			},
			onUpdate: "CASCADE",
			onDelete: "CASCADE"
		},
		cityId: {
			type: DataTypes.STRING(32),
			allowNull: false
		},
		itemCategory: {
			type: DataTypes.TINYINT.UNSIGNED,
			allowNull: false
		},
		itemId: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		},
		itemLevel: {
			type: DataTypes.TINYINT.UNSIGNED,
			allowNull: false
		},
		slot: {
			type: DataTypes.TINYINT.UNSIGNED,
			allowNull: false
		},
		date: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		}
	});
	await context.addIndex("scrap_dealer_recycles", ["playerId"], {
		name: "idx_scrap_dealer_recycles_playerId"
	});
	await context.addIndex("scrap_dealer_recycles", ["date"], {
		name: "idx_scrap_dealer_recycles_date"
	});
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await context.dropTable("scrap_dealer_recycles");
}
