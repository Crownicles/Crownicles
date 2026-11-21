import { QueryInterface } from "sequelize";

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	/*
	 * Players who died in 2021-2022 kept a travel start date set to the end of their death effect, about 31 years
	 * later, which migration 066 also copied into their last activity date. They looked active until 2053: the
	 * ranked fight matchmaking kept offering them as active opponents and the tops never marked them as inactive.
	 * Put both dates back at the date of death, like the players who died since then (#5140).
	 * The 'dead' effect id is inlined on purpose: a migration must keep describing the schema as it was when it ran,
	 * even if `Effect.DEAD` is renamed later.
	 */
	await context.sequelize.query(`
		UPDATE players
		SET startTravelDate = DATE_SUB(effectEndDate, INTERVAL effectDuration MINUTE),
			lastActivityAt = CASE
				WHEN lastActivityAt > NOW() THEN DATE_SUB(effectEndDate, INTERVAL effectDuration MINUTE)
				ELSE lastActivityAt
			END
		WHERE effectId = 'dead'
		  AND startTravelDate > NOW()
		  AND effectEndDate IS NOT NULL
		  AND effectDuration IS NOT NULL
	`);
}

export async function down(): Promise<void> {
	// No rollback: dates in 2053 would make those dead players active opponents again.
}
