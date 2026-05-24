import {
	ButtonBuilder,
	ChannelSelectMenuBuilder,
	MentionableSelectMenuBuilder,
	ModalBuilder,
	RoleSelectMenuBuilder,
	StringSelectMenuBuilder,
	TextInputBuilder,
	UserSelectMenuBuilder
} from "discord.js";
import { CrowniclesLogger } from "../../../Lib/src/logs/CrowniclesLogger";

/**
 * Discord enforces a hard 100-character limit on `customId` values for buttons,
 * select menus, modals and text inputs. When the limit is exceeded, Discord
 * silently drops the component or rejects the message with a confusing API
 * error. To make the bug loud and immediately attributable to the call site,
 * we patch every builder's `setCustomId` to fail fast with a clear stack trace.
 *
 * This is defense in depth — the long-term plan (see issue #4258) is also to
 * add a static ESLint rule encouraging a typed helper at construction time.
 */
const DISCORD_CUSTOM_ID_MAX_LENGTH = 100;

type CustomIdBuilder = {
	setCustomId(customId: string): unknown;
};

type CustomIdBuilderClass = new (...args: never[]) => CustomIdBuilder;

const BUILDERS_WITH_CUSTOM_ID: ReadonlyArray<CustomIdBuilderClass> = [
	ButtonBuilder,
	StringSelectMenuBuilder,
	UserSelectMenuBuilder,
	RoleSelectMenuBuilder,
	ChannelSelectMenuBuilder,
	MentionableSelectMenuBuilder,
	ModalBuilder,
	TextInputBuilder
] as unknown as ReadonlyArray<CustomIdBuilderClass>;

let installed = false;

export function installCustomIdGuard(): void {
	if (installed) {
		return;
	}
	installed = true;

	for (const Builder of BUILDERS_WITH_CUSTOM_ID) {
		const proto = Builder.prototype as CustomIdBuilder;
		const original = proto.setCustomId;
		proto.setCustomId = function patchedSetCustomId(customId: string): unknown {
			if (typeof customId !== "string") {
				const message = `[${Builder.name}] setCustomId received a non-string value (${typeof customId})`;
				CrowniclesLogger.error(message);
				throw new TypeError(message);
			}
			if (customId.length > DISCORD_CUSTOM_ID_MAX_LENGTH) {
				const message = `[${Builder.name}] customId exceeds Discord's ${DISCORD_CUSTOM_ID_MAX_LENGTH}-character limit (got ${customId.length}): "${customId}"`;
				CrowniclesLogger.error(message);
				throw new RangeError(message);
			}
			return original.call(this, customId);
		};
	}
}
