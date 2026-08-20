import { QueryInterface } from "sequelize";

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	/*
	 * Between the "cities2" merge and the fix of #4597, `addHealth` stopped calling `killIfNeeded`: every damage
	 * source outside of big events (small events, class change, ...) could leave a player alive with 0 health.
	 * Those "zombies" would then die at their next big event, seemingly without any reason.
	 * Give them back 10 health so they are not killed by the restored death check. Players who are actually dead
	 * (waiting for a respawn) keep their 0 health.
	 * The 'dead' effect id is inlined on purpose: a migration must keep describing the schema as it was when it ran,
	 * even if `Effect.DEAD` is renamed later.
	 */
	await context.sequelize.query(`
		UPDATE players
		SET health = 10
		WHERE health <= 0
		  AND effectId <> 'dead'
	`);
}

export async function down(): Promise<void> {
	// No rollback: putting those players back at 0 health would recreate the bug.
}
