import { QueryInterface } from "sequelize";

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	// Add index on scheduledAt for scheduled notification tables
	// These are commonly queried with WHERE scheduledAt < now() to find pending notifications

	await context.addIndex("scheduled_report_notifications", ["scheduledAt"], {
		name: "idx_scheduled_report_notifications_scheduledAt"
	});

	await context.addIndex("scheduled_expedition_notifications", ["scheduledAt"], {
		name: "idx_scheduled_expedition_notifications_scheduledAt"
	});

	await context.addIndex("scheduled_daily_bonus_notifications", ["scheduledAt"], {
		name: "idx_scheduled_daily_bonus_notifications_scheduledAt"
	});
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await context.removeIndex("scheduled_report_notifications", "idx_scheduled_report_notifications_scheduledAt");
	await context.removeIndex("scheduled_expedition_notifications", "idx_scheduled_expedition_notifications_scheduledAt");
	await context.removeIndex("scheduled_daily_bonus_notifications", "idx_scheduled_daily_bonus_notifications_scheduledAt");
}
