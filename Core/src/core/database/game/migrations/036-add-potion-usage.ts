import {
	DataTypes, QueryInterface
} from "sequelize";

/**
 * Adds remainingPotionUsages column to track multi-use potion consumption.
 * Existing fight potions will have NULL value, which is handled gracefully:
 * - PlayerBaseFighter.getRemainingUsages() falls back to potion.usages on NULL
 * - Potion.getDisplayPacket() shows max usages when NULL
 * This means existing potions appear as "full" and work normally.
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
	await context.addColumn("inventory_slots", "remainingPotionUsages", {
		type: DataTypes.INTEGER,
		allowNull: true,
		defaultValue: null
	});
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await context.removeColumn("inventory_slots", "remainingPotionUsages");
}
