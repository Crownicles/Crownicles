import {
	ButtonBuilder, StringSelectMenuBuilder
} from "discord.js";

/**
 * Discord enforces a 100-character limit on `customId` for buttons and select menus.
 * Exceeding it throws a confusing validation error deep inside discord.js. This helper
 * builds a `customId` from a prefix and arbitrary string parts, validates the total
 * length up front, and exposes a single point to update if the format ever changes.
 *
 * Use this whenever a `customId` is constructed from runtime data (recipe ids, item
 * slot indices, etc.) instead of building strings with template literals.
 *
 * @throws if the resulting id is empty, contains the path separator inside a part, or
 * exceeds Discord's 100-character cap.
 */
const DISCORD_CUSTOM_ID_MAX_LENGTH = 100;
const PART_SEPARATOR = "_";

function validatePart(part: string, prefix: string, totalParts: number): void {
	if (part.length === 0) {
		throw new Error(`buildCustomId: empty part in customId for prefix '${prefix}'`);
	}
	if (totalParts > 1 && part.includes(PART_SEPARATOR)) {
		throw new Error(`buildCustomId: part '${part}' contains the reserved separator '${PART_SEPARATOR}' (prefix '${prefix}')`);
	}
}

function assertWithinDiscordLimit(id: string): void {
	if (id.length === 0) {
		throw new Error("buildCustomId: empty customId");
	}
	if (id.length > DISCORD_CUSTOM_ID_MAX_LENGTH) {
		throw new Error(
			`buildCustomId: id '${id}' is ${id.length} chars, exceeds Discord limit of ${DISCORD_CUSTOM_ID_MAX_LENGTH}`
		);
	}
}

export function buildCustomId(prefix: string, ...parts: Array<string | number>): string {
	const partStrings = parts.map(p => String(p));
	for (const part of partStrings) {
		validatePart(part, prefix, partStrings.length);
	}
	const id = partStrings.length > 0 ? `${prefix}${partStrings.join(PART_SEPARATOR)}` : prefix;
	assertWithinDiscordLimit(id);
	return id;
}

/**
 * Convenience: build the customId and set it on a button or select menu in one call.
 */
export function setSafeCustomId<T extends ButtonBuilder | StringSelectMenuBuilder>(
	builder: T,
	prefix: string,
	...parts: Array<string | number>
): T {
	builder.setCustomId(buildCustomId(prefix, ...parts));
	return builder;
}
