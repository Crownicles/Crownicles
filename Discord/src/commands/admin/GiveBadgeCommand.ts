import { CrowniclesInteraction } from "../../messages/CrowniclesInteraction";
import { ICommand } from "../ICommand";
import { SlashCommandBuilderGenerator } from "../SlashCommandBuilderGenerator";
import { SlashCommandBuilder } from "@discordjs/builders";
import { KeycloakUser } from "../../../../Lib/src/keycloak/KeycloakUser";
import { RightGroup } from "../../../../Lib/src/types/RightGroup";
import { DiscordMQTT } from "../../bot/DiscordMQTT";
import { PacketUtils } from "../../utils/PacketUtils";
import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandGetResourcesReq,
	CommandGetResourcesRes
} from "../../../../Lib/src/packets/commands/CommandGetResourcesPacket";
import CommandRequirementHandlers from "../../packetHandlers/handlers/CommandRequirementHandlers";
import { RequirementRightPacket } from "../../../../Lib/src/packets/commands/requirements/RequirementRightPacket";
import {
	CommandGetPlayerInfoReq,
	CommandGetPlayerInfoRes
} from "../../../../Lib/src/packets/commands/CommandGetPlayerInfo";
import i18n from "../../translations/i18n";
import { CrowniclesErrorEmbed } from "../../messages/CrowniclesErrorEmbed";
import {
	ActionRowBuilder,
	parseEmoji,
	StringSelectMenuBuilder,
	StringSelectMenuInteraction,
	StringSelectMenuOptionBuilder
} from "discord.js";
import { CrowniclesIcons } from "../../../../Lib/src/CrowniclesIcons";
import { DiscordConstants } from "../../DiscordConstants";
import { Constants } from "../../../../Lib/src/constants/Constants";
import { sendInteractionNotForYou } from "../../utils/ErrorUtils";
import { CommandSetPlayerInfoReq } from "../../../../Lib/src/packets/commands/CommandSetPlayerInfo";
import { Badge } from "../../../../Lib/src/types/Badge";
import { CrowniclesEmbed } from "../../messages/CrowniclesEmbed";
import { escapeUsername } from "../../utils/StringUtils";
import { disableRows } from "../../utils/DiscordCollectorUtils";

async function handleGetPlayerInfoResponse(
	interaction: CrowniclesInteraction,
	context: PacketContext,
	packetName: string,
	packet: CrowniclesPacket,
	resources: CommandGetResourcesRes,
	targetKeycloakId: string
): Promise<void> {
	if (packetName === CommandGetPlayerInfoRes.name) {
		const getPlayerInfoPacket = packet as CommandGetPlayerInfoRes;
		if (!getPlayerInfoPacket.exists) {
			await interaction.editReply({
				embeds: [new CrowniclesErrorEmbed(interaction.user, context, interaction, i18n.t("error:playerDoesntExist", { lng: interaction.userLanguage }))]
			});
			return;
		}

		const badges = resources.badges!.filter(badge => !getPlayerInfoPacket.data.badges!.includes(badge));

		if (badges.length === 0) {
			await interaction.editReply({
				embeds: [new CrowniclesErrorEmbed(interaction.user, context, interaction, i18n.t("commands:giveBadge.alreadyHaveBadge", { lng: interaction.userLanguage }))]
			});
			return;
		}

		const rows: ActionRowBuilder<StringSelectMenuBuilder>[] = [];

		for (const badge of badges) {
			const badgeEmote = CrowniclesIcons.badges[badge];
			if (badgeEmote) {
				if (rows.length === 0 || rows[rows.length - 1].components[0].options.length >= DiscordConstants.MAX_SELECT_MENU_OPTIONS) {
					rows.push(new ActionRowBuilder<StringSelectMenuBuilder>());
					rows[rows.length - 1].addComponents(new StringSelectMenuBuilder()
						.setPlaceholder(i18n.t("commands:giveBadge.selectBadgePlaceholder", { lng: interaction.userLanguage }))
						.setCustomId(`giveBadge-${interaction.user.id}-${badge}`));
				}
				rows[rows.length - 1].components[0].addOptions(new StringSelectMenuOptionBuilder()
					.setLabel(i18n.t(`commands:profile.badges.${badge}`, { lng: interaction.userLanguage }))
					.setEmoji(parseEmoji(badgeEmote)!)
					.setValue(badge));
			}
		}

		const msg = await interaction.editReply({
			embeds: [
				new CrowniclesEmbed()
					.formatAuthor(i18n.t("commands:giveBadge.selectBadgeTitle", {
						lng: interaction.userLanguage,
						pseudo: escapeUsername(interaction.user.displayName)
					}), interaction.user)
					.setDescription(i18n.t("commands:giveBadge.selectBadgeDesc", { lng: interaction.userLanguage }))
			],
			components: rows
		});

		if (!msg) {
			return;
		}

		const selectCollector = msg.createMessageComponentCollector({
			time: Constants.MESSAGES.COLLECTOR_TIME
		});

		selectCollector.on("collect", async (selectMenuInteraction: StringSelectMenuInteraction) => {
			if (selectMenuInteraction.user.id !== context.discord?.user) {
				await sendInteractionNotForYou(selectMenuInteraction.user, selectMenuInteraction, interaction.userLanguage);
				return;
			}

			selectCollector.stop();

			disableRows(rows);

			await selectMenuInteraction.update({
				components: rows
			});

			const selectedOption = selectMenuInteraction.values[0];

			const newBadges = getPlayerInfoPacket.data.badges!.concat(selectedOption as Badge);
			PacketUtils.sendPacketToBackend(context, makePacket(CommandSetPlayerInfoReq, {
				keycloakId: targetKeycloakId,
				dataToSet: { badges: newBadges }
			}));
		});

		selectCollector.on("end", async () => {
			disableRows(rows);

			await msg.edit({ components: rows });
		});
	}
}

async function handleGetResourcesResponse(
	interaction: CrowniclesInteraction,
	resourcesContext: PacketContext,
	resourcesPacketName: string,
	resourcesPacket: CrowniclesPacket,
	targetKeycloakId: string
): Promise<void> {
	if (resourcesPacketName === CommandGetResourcesRes.name) {
		await DiscordMQTT.asyncPacketSender.sendPacketAndHandleResponse(resourcesContext, makePacket(CommandGetPlayerInfoReq, {
			keycloakId: targetKeycloakId,
			dataToGet: { badges: true }
		}), (playerInfoContext, playerInfoPacketName, playerInfoPacket) => {
			handleGetPlayerInfoResponse(interaction, playerInfoContext, playerInfoPacketName, playerInfoPacket, resourcesPacket, targetKeycloakId);
		});
	}
}

async function getPacket(interaction: CrowniclesInteraction, keycloakUser: KeycloakUser): Promise<null> {
	const context = await PacketUtils.createPacketContext(interaction, keycloakUser);

	if (!context.rightGroups?.includes(RightGroup.BADGES) && !context.rightGroups?.includes(RightGroup.ADMIN)) {
		await CommandRequirementHandlers.requirementRight(context, makePacket(RequirementRightPacket, {}));
		return null;
	}

	const askedPlayer = await PacketUtils.prepareAskedPlayer(interaction, keycloakUser);
	if (!askedPlayer) {
		return null;
	}

	await interaction.deferReply();

	await DiscordMQTT.asyncPacketSender.sendPacketAndHandleResponse(context, makePacket(CommandGetResourcesReq, { badges: true }), (resourcesContext, resourcesPacketName, resourcesPacket) =>
		handleGetResourcesResponse(interaction, resourcesContext, resourcesPacketName, resourcesPacket, askedPlayer.keycloakId!));

	return null;
}

export const commandInfo: ICommand = {
	slashCommandBuilder: SlashCommandBuilderGenerator.generateBaseCommand("giveBadge")
		.addUserOption(option =>
			SlashCommandBuilderGenerator.generateOption("giveBadge", "user", option)
				.setRequired(true)) as SlashCommandBuilder,
	getPacket,
	mainGuildCommand: true
};
