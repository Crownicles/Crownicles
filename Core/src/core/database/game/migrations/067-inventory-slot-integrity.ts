import {
	DataTypes, QueryInterface
} from "sequelize";

export async function compactInventorySlots(context: QueryInterface): Promise<void> {
	await context.sequelize.query(`
		DELETE FROM inventory_slots
		WHERE slot > 0
		  AND itemId = 0
	`);
	await context.sequelize.query(`
		CREATE TEMPORARY TABLE inventory_slot_compaction AS
		SELECT playerId,
		       itemCategory,
		       slot AS oldSlot,
		       ROW_NUMBER() OVER (PARTITION BY playerId, itemCategory ORDER BY slot) AS newSlot
		FROM inventory_slots
		WHERE slot > 0
	`);
	await context.sequelize.query(`
		UPDATE inventory_slots inventorySlot
		INNER JOIN inventory_slot_compaction compaction
		        ON compaction.playerId = inventorySlot.playerId
		       AND compaction.itemCategory = inventorySlot.itemCategory
		       AND compaction.oldSlot = inventorySlot.slot
		SET inventorySlot.slot = -inventorySlot.slot
		WHERE compaction.oldSlot <> compaction.newSlot
	`);
	await context.sequelize.query(`
		UPDATE inventory_slots inventorySlot
		INNER JOIN inventory_slot_compaction compaction
		        ON compaction.playerId = inventorySlot.playerId
		       AND compaction.itemCategory = inventorySlot.itemCategory
		       AND compaction.oldSlot = -inventorySlot.slot
		SET inventorySlot.slot = compaction.newSlot
		WHERE compaction.oldSlot <> compaction.newSlot
	`);
	await context.sequelize.query("DROP TEMPORARY TABLE inventory_slot_compaction");
}

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	await context.addColumn("home_chest_slots", "remainingPotionUsages", {
		type: DataTypes.INTEGER,
		allowNull: true,
		defaultValue: null
	});
	await compactInventorySlots(context);
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await context.removeColumn("home_chest_slots", "remainingPotionUsages");
}
