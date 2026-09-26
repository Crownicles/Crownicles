import { QueryInterface } from "sequelize";
import emojiToIdMap from "./010-possibilities-emoji-to-id.json";

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	for (const [eventId, eventPossibilities] of Object.entries(emojiToIdMap)) {
		for (const [emoji, id] of Object.entries(eventPossibilities)) {
			await context.bulkUpdate("possibilities", { possibilityName: id }, {
				bigEventId: parseInt(eventId, 10),
				possibilityName: emoji
			});
		}
	}
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	for (const [eventId, eventPossibilities] of Object.entries(emojiToIdMap)) {
		for (const [emoji, id] of Object.entries(eventPossibilities)) {
			await context.bulkUpdate("possibilities", { possibilityName: emoji }, {
				bigEventId: parseInt(eventId),
				possibilityName: id
			});
		}
	}
}
