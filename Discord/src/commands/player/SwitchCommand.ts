import {ICommand} from "../ICommand";
import {makePacket, PacketContext} from "../../../../Lib/src/packets/DraftBotPacket";
import {SlashCommandBuilderGenerator} from "../SlashCommandBuilderGenerator";
import {DiscordCache} from "../../bot/DiscordCache";
import i18n from "../../translations/i18n";
import {DraftbotInteraction} from "../../messages/DraftbotInteraction";
import {CommandSwitchPacketReq, CommandSwitchSuccess} from "../../../../Lib/src/packets/commands/CommandSwitchPacket";
import {DraftBotEmbed} from "../../messages/DraftBotEmbed";
import {ReactionCollectorCreationPacket} from "../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import {DiscordCollectorUtils} from "../../utils/DiscordCollectorUtils";
import {ReactionCollectorSwitchItemReaction} from "../../../../Lib/src/packets/interaction/ReactionCollectorSwitchItem";
import {DiscordItemUtils} from "../../utils/DiscordItemUtils";
import {MainItemDisplayPacket, SupportItemDisplayPacket} from "../../../../Lib/src/packets/commands/CommandInventoryPacket";
import {Language} from "../../../../Lib/src/Language";
import {EmbedField} from "discord.js";

/**
 * Get the respawn packet to send to the server
 * @param interaction
 */
async function getPacket(interaction: DraftbotInteraction): Promise<CommandSwitchPacketReq> {
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

	await interaction?.followUp({
		embeds: [new DraftBotEmbed()
			.formatAuthor(i18n.t("commands:switch.titleSuccess", {
				lng: interaction.userLanguage,
				pseudo: interaction.user.username
			}), interaction.user)
			.setDescription(i18n.t(`commands:switch.${packet.itemBackedUp.id === 0 ? "switchingSingle" : "switchingDouble"}`, {
				lng: interaction.userLanguage,
				item1: DiscordItemUtils.getShortDisplay(packet.itemEquipped, interaction.userLanguage),
				item2: DiscordItemUtils.getShortDisplay(packet.itemBackedUp, interaction.userLanguage)
			}))]
	});
}

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

export async function switchItemCollector(packet: ReactionCollectorCreationPacket, context: PacketContext): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction!);
	if (!interaction) {
		return;
	}
	const embed = new DraftBotEmbed()
		.formatAuthor(i18n.t("commands:switch.switchSelectionTitle", {
			lng: interaction.userLanguage,
			pseudo: interaction.user.username
		}), interaction.user)
		.setDescription(`${i18n.t("commands:switch.switchSelectionDescription", {
			lng: interaction.userLanguage
		})}\n\n`);
	const reactions: ReactionCollectorSwitchItemReaction[] = packet.reactions
		.map(reaction => reaction.data as ReactionCollectorSwitchItemReaction)
		.filter(reaction => reaction.item);
	await DiscordCollectorUtils.createChoiceListCollector(
		interaction,
		embed,
		packet,
		context,
		reactions.map(reaction => getFielder(reaction.item.itemCategory)(reaction.item as MainItemDisplayPacket & SupportItemDisplayPacket, interaction.userLanguage).value),
		true
	);
}

export const commandInfo: ICommand = {
	slashCommandBuilder: SlashCommandBuilderGenerator.generateBaseCommand("switch"),
	getPacket,
	mainGuildCommand: false
};