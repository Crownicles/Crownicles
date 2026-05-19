/* eslint-disable new-cap */
import {
	DataTypes, QueryInterface
} from "sequelize";

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	await context.createTable("blacksmith_upgrades", {
		playerId: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		cityId: {
			type: DataTypes.STRING(32),
			allowNull: false
		},
		itemCategory: {
			type: DataTypes.TINYINT.UNSIGNED,
			allowNull: false
		},
		slot: {
			type: DataTypes.TINYINT.UNSIGNED,
			allowNull: false
		},
		fromLevel: {
			type: DataTypes.SMALLINT.UNSIGNED,
			allowNull: false
		},
		toLevel: {
			type: DataTypes.SMALLINT.UNSIGNED,
			allowNull: false
		},
		totalCost: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		},
		boughtMaterials: {
			type: DataTypes.BOOLEAN,
			allowNull: false
		},
		materialsCost: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: true
		},
		date: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		}
	});

	await context.addIndex("blacksmith_upgrades", ["playerId"]);
	await context.addIndex("blacksmith_upgrades", ["cityId"]);
	await context.addIndex("blacksmith_upgrades", ["date"]);

	await context.createTable("blacksmith_disenchants", {
		playerId: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		cityId: {
			type: DataTypes.STRING(32),
			allowNull: false
		},
		itemCategory: {
			type: DataTypes.TINYINT.UNSIGNED,
			allowNull: false
		},
		slot: {
			type: DataTypes.TINYINT.UNSIGNED,
			allowNull: false
		},
		cost: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		},
		date: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		}
	});

	await context.addIndex("blacksmith_disenchants", ["playerId"]);
	await context.addIndex("blacksmith_disenchants", ["cityId"]);
	await context.addIndex("blacksmith_disenchants", ["date"]);
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await context.dropTable("blacksmith_disenchants");
	await context.dropTable("blacksmith_upgrades");
}
