import { ICommand } from "../ICommand";
import {
	makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { SlashCommandBuilderGenerator } from "../SlashCommandBuilderGenerator";
import { DiscordCache } from "../../bot/DiscordCache";
import i18n from "../../translations/i18n";
import { CrowniclesInteraction } from "../../messages/CrowniclesInteraction";
import {
	CommandSwitchPacketReq, CommandSwitchSuccess
} from "../../../../Lib/src/packets/commands/CommandSwitchPacket";
import { CrowniclesEmbed } from "../../messages/CrowniclesEmbed";
import { ReactionCollectorCreationPacket } from "../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import {
	DiscordCollectorUtils, SEND_POLITICS
} from "../../utils/DiscordCollectorUtils";
import {
	ReactionCollectorSwitchItemCloseReaction,
	ReactionCollectorSwitchItemReaction
} from "../../../../Lib/src/packets/interaction/ReactionCollectorSwitchItem";
import { DiscordItemUtils } from "../../utils/DiscordItemUtils";
import {
	MainItemDisplayPacket,
	SupportItemDisplayPacket
} from "../../../../Lib/src/packets/commands/CommandInventoryPacket";
import { Language } from "../../../../Lib/src/Language";
import { EmbedField } from "discord.js";
import { ReactionCollectorReturnTypeOrNull } from "../../packetHandlers/handlers/ReactionCollectorHandlers";
import { escapeUsername } from "../../utils/StringUtils";

/**
 * Get the switch command packet
 * @param interaction
 */
async function getPacket(interaction: CrowniclesInteraction): Promise<CommandSwitchPacketReq> {
	await interaction.deferReply();
	return makePacket(CommandSwitchPacketReq, {});
}

/**
 * Handle an item switch
 * @param packet
 * @param context
 */
export async function handleItemSwitch(packet: CommandSwitchSuccess, context: PacketContext): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction);
	if (!interaction) {
		return;
	}
	const buttonInteraction = DiscordCache.getButtonInteraction(context.discord!.buttonInteraction!);
	const lng = interaction.userLanguage;
	await (buttonInteraction ?? interaction)?.editReply({
		embeds: [
			new CrowniclesEmbed()
				.formatAuthor(i18n.t("commands:switch.titleSuccess", {
					lng,
					pseudo: escapeUsername(interaction.user.displayName)
				}), interaction.user)
				.setDescription(i18n.t(`commands:switch.${packet.itemBackedUp.id === 0 ? "switchingSingle" : "switchingDouble"}`, {
					lng,
					item1: DiscordItemUtils.getShortDisplay(packet.itemEquipped, lng),
					item2: DiscordItemUtils.getShortDisplay(packet.itemBackedUp, lng)
				}))
		]
	});
}

/**
 * Get the fielder for the item category
 * @param itemCategory
 */
function getFielder(itemCategory: number): ((displayPacket: MainItemDisplayPacket, lng: Language) => EmbedField) | ((displayPacket: SupportItemDisplayPacket, lng: Language) => EmbedField) {
	switch (itemCategory) {
		case 0:
			return DiscordItemUtils.getWeaponField;
		case 1:
			return DiscordItemUtils.getArmorField;
		case 2:
			return DiscordItemUtils.getPotionField;
		default:
			return DiscordItemUtils.getObjectField;
	}
}

export async function switchItemCollector(context: PacketContext, packet: ReactionCollectorCreationPacket): Promise<ReactionCollectorReturnTypeOrNull> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction!);
	if (!interaction) {
		return null;
	}
	const lng = interaction.userLanguage;
	const embed = new CrowniclesEmbed()
		.formatAuthor(i18n.t("commands:switch.switchSelectionTitle", {
			lng,
			pseudo: escapeUsername(interaction.user.displayName)
		}), interaction.user)
		.setDescription(`${i18n.t("commands:switch.switchSelectionDescription", { lng })}\n\n`);
	const reactions: ReactionCollectorSwitchItemReaction[] = packet.reactions
		.map(reaction => reaction.data as ReactionCollectorSwitchItemReaction)
		.filter(reaction => reaction.item);
	return await DiscordCollectorUtils.createChoiceListCollector(interaction, {
		packet,
		context
	}, {
		embed,
		items: reactions.map(reaction => getFielder(reaction.item.itemCategory)(reaction.item as MainItemDisplayPacket & SupportItemDisplayPacket, lng).value)
	}, {
		refuse: {
			can: true,
			reactionIndex: packet.reactions.findIndex(reaction => reaction.type === ReactionCollectorSwitchItemCloseReaction.name)
		},
		sendManners: SEND_POLITICS.EDIT_REPLY_OR_FOLLOWUP
	});
}

export const commandInfo: ICommand = {
	slashCommandBuilder: SlashCommandBuilderGenerator.generateBaseCommand("switch"),
	getPacket,
	mainGuildCommand: false
};
