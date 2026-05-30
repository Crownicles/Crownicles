/* eslint-disable new-cap */
import {
	DataTypes, QueryInterface
} from "sequelize";

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	await context.createTable("cooking_uses", {
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
			allowNull: true
		},
		recipeId: {
			type: DataTypes.STRING(32),
			allowNull: false
		},
		recipeLevel: {
			type: DataTypes.TINYINT.UNSIGNED,
			allowNull: false
		},
		outputType: {
			type: DataTypes.STRING(16),
			allowNull: false
		},
		success: {
			type: DataTypes.BOOLEAN,
			allowNull: false
		},
		bonus: {
			type: DataTypes.BOOLEAN,
			allowNull: false
		},
		wasSecret: {
			type: DataTypes.BOOLEAN,
			allowNull: false
		},
		xpGained: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		},
		levelUp: {
			type: DataTypes.BOOLEAN,
			allowNull: false
		},
		potionId: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: true
		},
		foodType: {
			type: DataTypes.STRING(16),
			allowNull: true
		},
		foodStored: {
			type: DataTypes.SMALLINT.UNSIGNED,
			allowNull: true
		},
		foodSurplus: {
			type: DataTypes.SMALLINT.UNSIGNED,
			allowNull: true
		},
		materialOutputId: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: true
		},
		date: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		}
	});
	await context.addIndex("cooking_uses", ["playerId"], {
		name: "idx_cooking_uses_playerId"
	});
	await context.addIndex("cooking_uses", ["recipeId"], {
		name: "idx_cooking_uses_recipeId"
	});
	await context.addIndex("cooking_uses", ["date"], {
		name: "idx_cooking_uses_date"
	});

	await context.createTable("garden_actions", {
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
			allowNull: true
		},
		action: {
			type: DataTypes.TINYINT.UNSIGNED,
			allowNull: false
		},
		plantId: {
			type: DataTypes.STRING(32),
			allowNull: false
		},
		slot: {
			type: DataTypes.TINYINT.UNSIGNED,
			allowNull: false
		},
		cost: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		quantity: {
			type: DataTypes.SMALLINT.UNSIGNED,
			allowNull: true
		},
		date: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		}
	});
	await context.addIndex("garden_actions", ["playerId", "action"], {
		name: "idx_garden_actions_playerId_action"
	});
	await context.addIndex("garden_actions", ["plantId"], {
		name: "idx_garden_actions_plantId"
	});
	await context.addIndex("garden_actions", ["date"], {
		name: "idx_garden_actions_date"
	});
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await context.dropTable("garden_actions");
	await context.dropTable("cooking_uses");
}
