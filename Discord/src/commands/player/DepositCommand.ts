import { CrowniclesInteraction } from "../../messages/CrowniclesInteraction";
import {
	makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandDepositPacketReq,
	CommandDepositSuccessPacket
} from "../../../../Lib/src/packets/commands/CommandDepositPacket";
import { ICommand } from "../ICommand";
import { SlashCommandBuilderGenerator } from "../SlashCommandBuilderGenerator";
import { ReactionCollectorReturnTypeOrNull } from "../../packetHandlers/handlers/ReactionCollectorHandlers";
import { DiscordCache } from "../../bot/DiscordCache";
import { CrowniclesEmbed } from "../../messages/CrowniclesEmbed";
import i18n from "../../translations/i18n";
import { escapeUsername } from "../../utils/StringUtils";
import {
	DiscordCollectorUtils, SEND_POLITICS
} from "../../utils/DiscordCollectorUtils";
import { DiscordItemUtils } from "../../utils/DiscordItemUtils";
import {
	ReactionCollectorDeposeItemCloseReaction, ReactionCollectorDeposeItemPacket,
	ReactionCollectorDeposeItemReaction
} from "../../../../Lib/src/packets/interaction/ReactionCollectorDeposeItem";
import { MessagesUtils } from "../../utils/MessagesUtils";
import { MainItemDetails } from "../../../../Lib/src/types/MainItemDetails";
import { SupportItemDetails } from "../../../../Lib/src/types/SupportItemDetails";

/**
 * Get the deposit command packet
 * @param interaction
 */
async function getPacket(interaction: CrowniclesInteraction): Promise<CommandDepositPacketReq> {
	await interaction.deferReply();
	return makePacket(CommandDepositPacketReq, {});
}

/**
 * Handle an item deposit
 * @param packet
 * @param context
 */
export async function handleItemDeposit(packet: CommandDepositSuccessPacket, context: PacketContext): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction);
	if (!interaction) {
		return;
	}
	const buttonInteraction = MessagesUtils.getCurrentInteraction(context);
	const lng = interaction.userLanguage;
	await (buttonInteraction ?? interaction)?.editReply({
		embeds: [
			new CrowniclesEmbed()
				.formatAuthor(i18n.t("commands:deposit.titleSuccess", {
					lng,
					pseudo: escapeUsername(interaction.user.displayName)
				}), interaction.user)
				.setDescription(i18n.t("commands:deposit.deposeSuccess", {
					lng,
					item: DiscordItemUtils.getShortDisplay(packet.item, lng)
				}))
		]
	});
}

export async function deposeItemCollector(context: PacketContext, packet: ReactionCollectorDeposeItemPacket): Promise<ReactionCollectorReturnTypeOrNull> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction!);
	if (!interaction) {
		return null;
	}
	const lng = interaction.userLanguage;
	const embed = new CrowniclesEmbed()
		.formatAuthor(i18n.t("commands:deposit.depositSelectionTitle", {
			lng,
			pseudo: escapeUsername(interaction.user.displayName)
		}), interaction.user)
		.setDescription(`${i18n.t("commands:deposit.depositSelectionDescription", { lng })}\n\n`);
	const reactions: ReactionCollectorDeposeItemReaction[] = packet.reactions
		.filter(
			(r): r is {
				type: string; data: ReactionCollectorDeposeItemReaction;
			} =>
				r.type === ReactionCollectorDeposeItemReaction.name
		)
		.map(r => r.data);
	return await DiscordCollectorUtils.createChoiceListCollector(interaction, {
		packet,
		context
	}, {
		embed,
		items: reactions.map(reaction => DiscordItemUtils.getFielder(reaction.item.itemCategory)(reaction.item as MainItemDetails & SupportItemDetails, lng).value)
	}, {
		refuse: {
			can: true,
			reactionIndex: packet.reactions.findIndex(reaction => reaction.type === ReactionCollectorDeposeItemCloseReaction.name)
		},
		sendManners: SEND_POLITICS.EDIT_REPLY_OR_FOLLOWUP
	});
}

export const commandInfo: ICommand = {
	slashCommandBuilder: SlashCommandBuilderGenerator.generateBaseCommand("deposit"),
	getPacket,
	mainGuildCommand: false
};
