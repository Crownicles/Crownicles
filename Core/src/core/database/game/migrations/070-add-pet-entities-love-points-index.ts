import { QueryInterface } from "sequelize";

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	/*
	 * The daily love loss filters on lovePoints, which had no index: InnoDB fell back
	 * to a full table scan and locked every row it examined (8 400) to update the few
	 * hundred that actually match, deadlocking against concurrent pet commands.
	 */
	await context.addIndex("pet_entities", ["lovePoints"], {
		name: "idx_pet_entities_lovePoints"
	});
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await context.removeIndex("pet_entities", "idx_pet_entities_lovePoints");
}
