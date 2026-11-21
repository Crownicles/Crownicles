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
	 * Click on a button Core is responding to, while it can still be answered (see DiscordCollectorUtils.sendReaction)
	 * @param context
	 */
	static getButtonClick(context: PacketContext): CrowniclesInteraction | null {
		const clickId = context.discord?.buttonInteraction;
		return clickId ? DiscordCache.getButtonInteraction(clickId) : null;
	}

	/**
	 * Selection in a menu or click on a button Core is responding to, while it can still be answered
	 * @param context
	 */
	static getAnswerableClick(context: PacketContext): CrowniclesInteraction | null {
		const selectionId = context.discord?.stringSelectMenuInteraction;
		return (selectionId ? DiscordCache.getStringSelectMenuInteraction(selectionId) : null) ?? MessagesUtils.getButtonClick(context);
	}

	/**
	 * Interaction to answer for the context: the answerable click Core is responding to, the command otherwise
	 * @param context
	 */
	static getCurrentInteraction(context: PacketContext): CrowniclesInteraction {
		return MessagesUtils.getAnswerableClick(context) ?? DiscordCache.getInteraction(context.discord!.interaction)!;
	}

	/**
	 * Display Core's response to a button click in the reply deferred on the click. When the click could not be
	 * acknowledged, Discord accepts no answer to it anymore and the response is a follow-up of the command instead (#5059).
	 * Nothing is displayed when the collector ended without any click
	 */
	static async editClickReply(context: PacketContext, options: ClickReplyOptions): Promise<void> {
		if (!context.discord?.buttonInteraction) {
			return;
		}
		const buttonClick = MessagesUtils.getButtonClick(context);
		if (buttonClick) {
			await buttonClick.editReply(options);
			return;
		}
		await DiscordCache.getInteraction(context.discord.interaction)?.followUp(options);
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
	 * User who made the click (button or selection) Core is responding to, also known when the click could not be
	 * acknowledged. It differs from the command author in the collectors other players can answer
	 */
	static getClickUser(context: PacketContext): User | null {
		const clickId = context.discord?.buttonInteraction ?? context.discord?.stringSelectMenuInteraction;
		if (!clickId) {
			return null;
		}
		return MessagesUtils.getAnswerableClick(context)?.user ?? DiscordCache.getUnanswerableClickUser(clickId);
	}
}
