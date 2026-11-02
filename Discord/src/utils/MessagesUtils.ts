import { CrowniclesInteraction } from "../messages/CrowniclesInteraction";
import { DiscordCache } from "../bot/DiscordCache";
import { PacketContext } from "../../../Lib/src/packets/CrowniclesPacket";
import {
	BaseMessageOptions, User
} from "discord.js";

/**
 * Content of the response to a click, displayable both by editing a reply and by a follow-up
 */
type ClickReplyOptions = Pick<BaseMessageOptions, "content" | "embeds" | "components">;

export abstract class MessagesUtils {
	/**
	 * Get the current interaction from the context and cast it to CrowniclesInteraction.
	 * It selects either the string select menu interaction, the button interaction or the interaction depending on which one is present in the context.
	 * The order of priority is string select menu interaction > button interaction > interaction.
	 * The interaction is retrieved from the DiscordCache.
	 * @param context
	 */
	static getCurrentInteraction(context: PacketContext): CrowniclesInteraction {
		if (context.discord!.stringSelectMenuInteraction) {
			const stringSelectMenuInteraction = DiscordCache.getStringSelectMenuInteraction(context.discord!.stringSelectMenuInteraction);
			if (stringSelectMenuInteraction) {
				return CrowniclesInteraction.cast(stringSelectMenuInteraction);
			}
		}

		if (context.discord!.buttonInteraction) {
			const buttonInteraction = DiscordCache.getButtonInteraction(context.discord!.buttonInteraction);
			if (buttonInteraction) {
				return CrowniclesInteraction.cast(buttonInteraction);
			}
		}

		return DiscordCache.getInteraction(context.discord!.interaction)!;
	}

	/**
	 * Display Core's response to a button click in the reply deferred on the click. When the click could not be
	 * acknowledged, Discord accepts no answer to it anymore and the response is a follow-up of the command instead (#5059).
	 * Nothing is displayed when the collector ended without any click
	 */
	static async editClickReply(context: PacketContext, options: ClickReplyOptions): Promise<void> {
		const clickId = context.discord?.buttonInteraction;
		if (!clickId) {
			return;
		}
		const buttonInteraction = DiscordCache.getButtonInteraction(clickId);
		if (buttonInteraction) {
			await buttonInteraction.editReply(options);
			return;
		}
		await DiscordCache.getInteraction(context.discord!.interaction)?.followUp(options);
	}

	/**
	 * Display Core's response in the reply deferred on the click when there was one (see editClickReply), in the reply
	 * to the command otherwise, e.g. when the collector ended without any click
	 */
	static async editClickOrCommandReply(context: PacketContext, options: ClickReplyOptions): Promise<void> {
		if (context.discord?.buttonInteraction) {
			await MessagesUtils.editClickReply(context, options);
			return;
		}
		await DiscordCache.getInteraction(context.discord!.interaction)?.editReply(options);
	}

	/**
	 * User who made the button click Core is responding to, also known when the click could not be acknowledged.
	 * It differs from the command author in the collectors other players can answer
	 */
	static getClickUser(context: PacketContext): User | null {
		const clickId = context.discord?.buttonInteraction;
		if (!clickId) {
			return null;
		}
		return DiscordCache.getButtonInteraction(clickId)?.user ?? DiscordCache.getUnanswerableClickUser(clickId);
	}
}
