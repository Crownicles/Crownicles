import { Message } from "discord.js";
import {
	CrowniclesNestedMenuCollector, CrowniclesNestedMenus
} from "../../../../messages/CrowniclesNestedMenus";
import {
	HomeFeatureHandler, HomeFeatureHandlerContext
} from "./HomeMenuTypes";
import { sendInteractionNotForYou } from "../../../../utils/ErrorUtils";

/**
 * Options for creating a home feature collector
 */
interface HomeCollectorOptions {

	/** Called when the collector ends (with the reason) */
	onEnd?: (reason: string) => void;
}

/**
 * Creates a standard collector factory for home feature sub-menus.
 * Handles user ID validation, deferUpdate delegation, and routes button interactions
 * to the handler's handleSubMenuSelection.
 */
export function createHomeFeatureCollector(
	handler: HomeFeatureHandler,
	ctx: HomeFeatureHandlerContext,
	options?: HomeCollectorOptions
): (menus: CrowniclesNestedMenus, message: Message) => CrowniclesNestedMenuCollector {
	return (menus: CrowniclesNestedMenus, message: Message): CrowniclesNestedMenuCollector => {
		const collector = message.createMessageComponentCollector({ time: ctx.collectorTime });

		collector.on("collect", async interaction => {
			if (interaction.user.id !== ctx.user.id) {
				await sendInteractionNotForYou(interaction.user, interaction, ctx.lng);
				return;
			}

			if (interaction.isButton()) {
				await handler.handleSubMenuSelection(ctx, interaction.customId, interaction, menus);
			}
		});

		if (options?.onEnd) {
			collector.on("end", (_collected, reason) => {
				options.onEnd!(reason);
			});
		}

		return collector;
	};
}
