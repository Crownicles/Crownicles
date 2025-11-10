import { CrowniclesInteraction } from "../../messages/CrowniclesInteraction";
import {
	makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandPetSellPacketReq,
	CommandPetSellSuccessPacket
} from "../../../../Lib/src/packets/commands/CommandPetSellPacket";
import { ICommand } from "../ICommand";
import { SlashCommandBuilderGenerator } from "../SlashCommandBuilderGenerator";
import { SlashCommandBuilder } from "@discordjs/builders";
import { ReactionCollectorCreationPacket } from "../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { DiscordCache } from "../../bot/DiscordCache";
import { CrowniclesEmbed } from "../../messages/CrowniclesEmbed";
import i18n from "../../translations/i18n";
import { DisplayUtils } from "../../utils/DisplayUtils";
import { DiscordCollectorUtils } from "../../utils/DiscordCollectorUtils";
import { ReactionCollectorPetSellData } from "../../../../Lib/src/packets/interaction/ReactionCollectorPetSell";
import { handleCommandGuildDailyRewardPacket } from "../guild/GuildDailyCommand";
import { CommandGuildDailyRewardPacket } from "../../../../Lib/src/packets/commands/CommandGuildDailyPacket";
import { ReactionCollectorReturnTypeOrNull } from "../../packetHandlers/handlers/ReactionCollectorHandlers";
import { escapeUsername } from "../../../../Lib/src/utils/StringUtils";
import { PacketUtils } from "../../utils/PacketUtils";
import { KeycloakUser } from "../../../../Lib/src/keycloak/KeycloakUser";

async function getPacket(interaction: CrowniclesInteraction, keycloakUser: KeycloakUser): Promise<CommandPetSellPacketReq | null> {
	const price = <number>interaction.options.get("price", true).value;

	const askedPlayer = await PacketUtils.prepareAskedPlayer(interaction, keycloakUser);
	if (!askedPlayer) {
		return null;
	}

	return makePacket(CommandPetSellPacketReq, {
		askedPlayer: !interaction.options.getUser("user") && askedPlayer.keycloakId === keycloakUser.id ? {} : askedPlayer,
		price
	});
}

export async function createPetSellCollector(context: PacketContext, packet: ReactionCollectorCreationPacket): Promise<ReactionCollectorReturnTypeOrNull> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction)!;
	await interaction.deferReply();
	const data = packet.data.data as ReactionCollectorPetSellData;
	const lng = interaction.userLanguage;
	const buyerUser = interaction.options.getUser("user");

	let description = i18n.t("commands:petSell.sellDescription", {
		lng,
		pseudo: escapeUsername(interaction.user.displayName),
		price: data.price
	});
	if (data.isGuildAtMaxLevel) {
		description += `\n\n${i18n.t("commands:petSell.maxLevelWarning", { lng })}`;
	}

	const embedKeyTitle = buyerUser ? "sellTitleWithBuyer" : "sellTitle";

	const embed = new CrowniclesEmbed()
		.formatAuthor(
			i18n.t(`commands:petSell.${embedKeyTitle}`, {
				lng,
				buyer: buyerUser?.displayName,
				seller: interaction.user.displayName
			}),
			buyerUser ?? interaction.user
		)
		.setDescription(description)
		.addFields([
			{
				name: i18n.t("commands:petSell.petFieldName", {
					lng
				}),
				value: DisplayUtils.getOwnedPetFieldDisplay(data.pet, lng),
				inline: false
			}
		])
		.setFooter({
			text: i18n.t("commands:petSell.sellFooter", {
				lng
			})
		});

	const opts = data.buyerKeycloakId
		? {
			acceptedUsersId: [data.buyerKeycloakId, context.keycloakId!]
		}
		: { anyoneCanReact: true };

	return await DiscordCollectorUtils.createAcceptRefuseCollector(interaction, embed, packet, context, opts);
}

export async function handlePetSellSuccess(context: PacketContext, packet: CommandPetSellSuccessPacket): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction)!;
	const buttonInteraction = DiscordCache.getButtonInteraction(context.discord!.buttonInteraction!)!;
	const lng = interaction.userLanguage;

	// Send guild XP reward
	if (!packet.isGuildMax) {
		await handleCommandGuildDailyRewardPacket(makePacket(CommandGuildDailyRewardPacket, {
			guildXp: packet.xpEarned,
			guildName: packet.guildName
		}), context, false);
	}

	// Send pet sell success message
	await buttonInteraction.editReply({
		embeds: [
			new CrowniclesEmbed()
				.formatAuthor(
					i18n.t("commands:petSell.successTitle", {
						lng,
						pseudo: escapeUsername(buttonInteraction.user.displayName)
					}),
					buttonInteraction.user
				)
				.setDescription(
					i18n.t("commands:petSell.successDescription", {
						lng,
						pet: DisplayUtils.getOwnedPetInlineDisplay(packet.pet, lng)
					})
				)
		]
	});
}

export const commandInfo: ICommand = {
	slashCommandBuilder: SlashCommandBuilderGenerator.generateBaseCommand("petSell")
		.addNumberOption(option =>
			SlashCommandBuilderGenerator.generateOption("petSell", "price", option)
				.setRequired(true))
		.addUserOption(option =>
			SlashCommandBuilderGenerator.generateOption("petSell", "user", option)
				.setRequired(false)) as SlashCommandBuilder,
	getPacket,
	mainGuildCommand: false
};
