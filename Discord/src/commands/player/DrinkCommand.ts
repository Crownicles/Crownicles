import { ICommand } from "../ICommand";
import {
	makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { SlashCommandBuilderGenerator } from "../SlashCommandBuilderGenerator";
import { CrowniclesInteraction } from "../../messages/CrowniclesInteraction";
import {
	CommandDrinkConsumePotionRes,
	CommandDrinkPacketReq
} from "../../../../Lib/src/packets/commands/CommandDrinkPacket";
import { DiscordCache } from "../../bot/DiscordCache";
import i18n from "../../translations/i18n";
import { CrowniclesEmbed } from "../../messages/CrowniclesEmbed";
import { ReactionCollectorCreationPacket } from "../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { DisplayUtils } from "../../utils/DisplayUtils";
import { DiscordCollectorUtils } from "../../utils/DiscordCollectorUtils";
import { ReactionCollectorDrinkData } from "../../../../Lib/src/packets/interaction/ReactionCollectorDrink";
import { minutesDisplay } from "../../../../Lib/src/utils/TimeUtils";
import { ReactionCollectorReturnTypeOrNull } from "../../packetHandlers/handlers/ReactionCollectorHandlers";
import { escapeUsername } from "../../utils/StringUtils";
import { SlashCommandBuilder } from "@discordjs/builders";

/**
 * Get the daily bonus packet to send to the server
 * @param interaction
 */
async function getPacket(interaction: CrowniclesInteraction): Promise<CommandDrinkPacketReq> {
	const forceOption = interaction.options.get("force");

	let force = false;
	if (forceOption) {
		force = <boolean>forceOption.value;
	}

	await interaction.deferReply();
	return makePacket(CommandDrinkPacketReq, { force });
}

export async function drinkAcceptCollector(context: PacketContext, packet: ReactionCollectorCreationPacket): Promise<ReactionCollectorReturnTypeOrNull> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction)!;
	const data = packet.data.data as ReactionCollectorDrinkData;
	const lng = interaction.userLanguage;
	const embed = new CrowniclesEmbed()
		.formatAuthor(
			i18n.t("commands:drink.confirmationTitle", {
				pseudo: escapeUsername(interaction.user.displayName),
				lng
			}),
			interaction.user
		)
		.setDescription(i18n.t("commands:drink.confirmation", {
			lng,
			potion: DisplayUtils.getItemDisplayWithStats(data.potion, lng)
		}))
		.setFooter({ text: i18n.t("commands:drink.confirmationFooter", { lng }) });

	return await DiscordCollectorUtils.createAcceptRefuseCollector(interaction, embed, packet, context);
}

export async function handleDrinkConsumePotion(context: PacketContext, packet: CommandDrinkConsumePotionRes): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction);
	const mainInteraction = context.discord!.buttonInteraction
		? DiscordCache.getButtonInteraction(context.discord!.buttonInteraction)
		: DiscordCache.getInteraction(context.discord!.interaction);
	if (!interaction || !mainInteraction) {
		return;
	}
	const lng = interaction.userLanguage;
	let msg;
	if (packet.time) {
		msg = i18n.t("commands:drink.timeBonus", {
			lng,
			value: minutesDisplay(packet.time, lng)
		});
	}
	else if (packet.energy) {
		msg = i18n.t("commands:drink.energyBonus", {
			lng,
			value: packet.energy
		});
	}
	else if (packet.health) {
		msg = i18n.t("commands:drink.healthBonus", {
			lng,
			value: packet.health
		});
	}
	else {
		msg = i18n.t("commands:drink.noBonus", { lng });
	}

	await mainInteraction.followUp({
		embeds: [
			new CrowniclesEmbed()
				.formatAuthor(i18n.t("commands:drink.drinkSuccessTitle", {
					pseudo: escapeUsername(interaction.user.displayName),
					lng
				}), interaction.user)
				.setDescription(msg)
		]
	});
}

export async function handleDrinkCancellation(context: PacketContext): Promise<void> {
	const interaction = DiscordCache.getButtonInteraction(context.discord!.buttonInteraction!);
	if (!interaction) {
		return;
	}
	const lng = context.discord!.language;

	await interaction.editReply({
		embeds: [
			new CrowniclesEmbed()
				.formatAuthor(i18n.t("commands:drink.cancelledTitle", {
					lng,
					pseudo: escapeUsername(interaction.user.displayName)
				}), interaction.user)
				.setDescription(i18n.t("commands:drink.cancelled", { lng }))
		]
	});
}

export const commandInfo: ICommand = {
	slashCommandBuilder: SlashCommandBuilderGenerator.generateBaseCommand("drink")
		.addBooleanOption(option =>
			SlashCommandBuilderGenerator.generateOption("drink", "force", option)) as SlashCommandBuilder,
	getPacket,
	mainGuildCommand: false
};
