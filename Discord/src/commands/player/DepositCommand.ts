import { CrowniclesInteraction } from "../../messages/CrowniclesInteraction";
import {
	makePacket,
	PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandDepositPacketReq,
	CommandDepositSuccessPacket
} from "../../../../Lib/src/packets/commands/CommandDepositPacket";
import { ICommand } from "../ICommand";
import { SlashCommandBuilderGenerator } from "../SlashCommandBuilderGenerator";
import { ReactionCollectorCreationPacket } from "../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { ReactionCollectorReturnTypeOrNull } from "../../packetHandlers/handlers/ReactionCollectorHandlers";
import { DiscordCache } from "../../bot/DiscordCache";
import { CrowniclesEmbed } from "../../messages/CrowniclesEmbed";
import i18n from "../../translations/i18n";
import { escapeUsername } from "../../utils/StringUtils";
import {
	DiscordCollectorUtils,
	SEND_POLITICS
} from "../../utils/DiscordCollectorUtils";
import {
	MainItemDisplayPacket,
	SupportItemDisplayPacket
} from "../../../../Lib/src/packets/commands/CommandInventoryPacket";
import { Language } from "../../../../Lib/src/Language";
import { EmbedField } from "discord.js";
import { DiscordItemUtils } from "../../utils/DiscordItemUtils";
import {
	ReactionCollectorDeposeItemCloseReaction,
	ReactionCollectorDeposeItemReaction
} from "../../../../Lib/src/packets/interaction/ReactionCollectorDeposeItem";

async function getPacket(interaction: CrowniclesInteraction): Promise<CommandDepositPacketReq> {
	await interaction.deferReply();
	return makePacket(CommandDepositPacketReq, {});
}

export async function handleItemDeposit(packet: CommandDepositSuccessPacket, context: PacketContext): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction);
	if (!interaction) {
		return;
	}
	const buttonInteraction = DiscordCache.getButtonInteraction(context.discord!.buttonInteraction!);
	const lng = interaction.userLanguage;
	await (buttonInteraction ?? interaction)?.editReply({
		embeds: [
			new CrowniclesEmbed()
				.formatAuthor(i18n.t("commands:deposit.titleSuccess", {
					lng,
					pseudo: escapeUsername(interaction.user.displayName)
				}), interaction.user)
				.setDescription(i18n.t(`commands:deposit.deposeSuccess`, {
					lng,
					item: DiscordItemUtils.getShortDisplay(packet.item, lng)
				}))
		]
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

export async function deposeItemCollector(context: PacketContext, packet: ReactionCollectorCreationPacket): Promise<ReactionCollectorReturnTypeOrNull> {
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
		.map(reaction => reaction.data as ReactionCollectorDeposeItemReaction)
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
