/* eslint-disable new-cap */
import {
	DataTypes, QueryInterface
} from "sequelize";

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	await context.createTable("blacksmith_enchantment_transfers", {
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
		sourceSlot: {
			type: DataTypes.TINYINT.UNSIGNED,
			allowNull: false
		},
		targetSlot: {
			type: DataTypes.TINYINT.UNSIGNED,
			allowNull: false
		},
		enchantmentId: {
			type: DataTypes.STRING(32),
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
	await context.addIndex("blacksmith_enchantment_transfers", ["playerId"], {
		name: "idx_blacksmith_enchantment_transfers_playerId"
	});
	await context.addIndex("blacksmith_enchantment_transfers", ["date"], {
		name: "idx_blacksmith_enchantment_transfers_date"
	});
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await context.dropTable("blacksmith_enchantment_transfers");
}
