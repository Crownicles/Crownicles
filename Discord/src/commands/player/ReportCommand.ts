import { ICommand } from "../ICommand";
import {
	makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { CrowniclesInteraction } from "../../messages/CrowniclesInteraction";
import { SlashCommandBuilderGenerator } from "../SlashCommandBuilderGenerator";
import {
	CommandReportBigEventResultRes,
	CommandReportChooseDestinationCityRes,
	CommandReportPacketReq
} from "../../../../Lib/src/packets/commands/CommandReportPacket";
import { ReactionCollectorCreationPacket } from "../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import {
	ReactionCollectorBigEventData,
	ReactionCollectorBigEventPossibilityReaction
} from "../../../../Lib/src/packets/interaction/ReactionCollectorBigEvent";
import i18n, { I18nCrowniclesOptions } from "../../translations/i18n";
import {
	ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, parseEmoji
} from "discord.js";
import { DiscordCache } from "../../bot/DiscordCache";
import { CrowniclesIcons } from "../../../../Lib/src/CrowniclesIcons";
import { sendInteractionNotForYou } from "../../utils/ErrorUtils";
import { Effect } from "../../../../Lib/src/types/Effect";
import { minutesDisplayIntl } from "../../../../Lib/src/utils/TimeUtils";
import { CrowniclesEmbed } from "../../messages/CrowniclesEmbed";
import { ReactionCollectorChooseDestinationReaction } from "../../../../Lib/src/packets/interaction/ReactionCollectorChooseDestination";
import {
	disableRows, DiscordCollectorUtils
} from "../../utils/DiscordCollectorUtils";
import { ReportConstants } from "../../../../Lib/src/constants/ReportConstants";
import { ReactionCollectorReturnTypeOrNull } from "../../packetHandlers/handlers/ReactionCollectorHandlers";
import { Language } from "../../../../Lib/src/Language";
import { DisplayUtils } from "../../utils/DisplayUtils";

async function getPacket(interaction: CrowniclesInteraction): Promise<CommandReportPacketReq> {
	await interaction.deferReply();
	return makePacket(CommandReportPacketReq, {});
}

/**
 * Display the big event collector that allows the player to choose the possibility of the big event
 * @param context
 * @param packet
 */
export async function createBigEventCollector(context: PacketContext, packet: ReactionCollectorCreationPacket): Promise<ReactionCollectorReturnTypeOrNull> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction)!;
	const lng = interaction.userLanguage;
	const data = packet.data.data as ReactionCollectorBigEventData;
	const reactions = packet.reactions.map(reaction => reaction.data) as ReactionCollectorBigEventPossibilityReaction[];

	const rows = [new ActionRowBuilder<ButtonBuilder>()];
	let eventText = `${i18n.t(`events:${data.eventId}.text`, {
		lng
	})}\n\n`;
	for (const possibility of reactions) {
		if (possibility.name !== ReportConstants.END_POSSIBILITY_ID) {
			const emoji = CrowniclesIcons.events[data.eventId.toString()][possibility.name] as string;

			const button = new ButtonBuilder()
				.setEmoji(parseEmoji(emoji)!)
				.setCustomId(possibility.name)
				.setStyle(ButtonStyle.Secondary);

			DiscordCollectorUtils.addButtonToRow(rows, button);

			const reactionText = `${emoji} ${i18n.t(`events:${data.eventId}.possibilities.${possibility.name}.text`, {
				lng
			})}`;
			eventText += `${reactionText}\n`;
		}
	}

	const msgOptions = {
		content: i18n.t("commands:report.doEvent", {
			lng,
			event: eventText,
			pseudo: await DisplayUtils.getEscapedUsername(context.keycloakId!, lng)
		}),
		components: rows
	};

	// Can be from a string select menu when the player started the event from a city
	const msg = context.discord?.stringSelectMenuInteraction ? await interaction.followUp(msgOptions) : await interaction.editReply(msgOptions);
	if (!msg) {
		return null;
	}

	let responded = false; // To avoid concurrence between the button controller and reaction controller
	const respondToEvent = (possibilityName: string, buttonInteraction: ButtonInteraction | null): void => {
		if (!responded) {
			responded = true;
			DiscordCollectorUtils.sendReaction(packet, context, context.keycloakId!, buttonInteraction, reactions.findIndex(reaction => reaction.name === possibilityName));
		}
	};

	const buttonCollector = msg.createMessageComponentCollector({
		time: packet.endTime - Date.now()
	});

	const endCollector = msg.createReactionCollector({
		time: packet.endTime - Date.now(),
		filter: (reaction, user) => reaction.emoji.name === CrowniclesIcons.messages.notReplied && user.id === interaction.user.id
	});

	buttonCollector.on("collect", async (buttonInteraction: ButtonInteraction) => {
		if (buttonInteraction.user.id !== context.discord?.user) {
			await sendInteractionNotForYou(buttonInteraction.user, buttonInteraction, lng);
			return;
		}

		await buttonInteraction.deferReply();
		respondToEvent(buttonInteraction.customId, buttonInteraction);
	});

	endCollector.on("collect", () => {
		respondToEvent(ReportConstants.END_POSSIBILITY_ID, null);
	});

	buttonCollector.on("end", async () => {
		// Disable buttons instead of removing them
		disableRows(rows);

		await msg.edit({ components: rows });
	});

	return [buttonCollector, endCollector];
}

type Condition = boolean | number | undefined;
type ConditionTriplet = [Condition, string, Omit<I18nCrowniclesOptions, "lng">];

function getReportResultConditionTriplets(packet: CommandReportBigEventResultRes, lng: Language): ConditionTriplet[] {
	return [
		[
			packet.score,
			"points",
			{ score: packet.score }
		],
		[
			packet.money < 0,
			"moneyLoose",
			{ money: -packet.money }
		],
		[
			packet.money > 0,
			"money",
			{ money: packet.money }
		],
		[
			packet.health < 0,
			"healthLoose",
			{ health: -packet.health }
		],
		[
			packet.health > 0,
			"health",
			{ health: packet.health }
		],
		[
			packet.energy,
			"energy",
			{ energy: packet.energy }
		],
		[
			packet.gems,
			"gems",
			{ gems: packet.gems }
		],
		[
			packet.experience,
			"experience",
			{ experience: packet.experience }
		],
		[
			packet.effect?.name === Effect.OCCUPIED.id,
			"timeLost",
			{ timeLost: packet.effect ? minutesDisplayIntl(packet.effect.time, lng) : 0 }
		]
	];
}

/**
 * Display the result of the big event
 * @param packet
 * @param context
 */
export async function reportResult(packet: CommandReportBigEventResultRes, context: PacketContext): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction)!;
	const lng = interaction.userLanguage;

	const result = getReportResultConditionTriplets(packet, lng)
		.map(triplet => triplet[0]
			? i18n.t(`commands:report.${triplet[1]}`, {
				lng,
				...triplet[2]
			})
			: "")
		.join("");

	const content = i18n.t("commands:report.doPossibility", {
		lng,
		pseudo: await DisplayUtils.getEscapedUsername(context.keycloakId!, lng),
		result,
		event: i18n.t(`events:${packet.eventId}.possibilities.${packet.possibilityId}.outcomes.${packet.outcomeId}`, { lng }),
		emoji: packet.possibilityId === ReportConstants.END_POSSIBILITY_ID
			? CrowniclesIcons.events[packet.eventId].end[packet.outcomeId]
			: CrowniclesIcons.events[packet.eventId][packet.possibilityId] as string,
		alte: packet.effect && packet.effect.name !== Effect.OCCUPIED.id ? CrowniclesIcons.effects[packet.effect.name] : ""
	});

	const buttonInteraction = context.discord?.buttonInteraction ? DiscordCache.getButtonInteraction(context.discord?.buttonInteraction) : null;

	if (buttonInteraction) {
		await buttonInteraction.editReply({ content });
	}
	else {
		await interaction.channel.send({ content });
	}
}

/**
 * Display the travel destination collector that allows the player to choose the destination of his next trip
 * @param context
 * @param packet
 */
export async function chooseDestinationCollector(context: PacketContext, packet: ReactionCollectorCreationPacket): Promise<ReactionCollectorReturnTypeOrNull> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction)!;
	const lng = interaction.userLanguage;

	const embed = new CrowniclesEmbed();
	embed.formatAuthor(i18n.t("commands:report.destinationTitle", {
		lng,
		pseudo: await DisplayUtils.getEscapedUsername(context.keycloakId!, lng)
	}), interaction.user);
	embed.setDescription(`${i18n.t("commands:report.chooseDestinationIndications", { lng })}\n\n`);

	return await DiscordCollectorUtils.createChoiceListCollector(interaction, {
		packet,
		context
	}, {
		embed,
		items: packet.reactions.map(reaction => {
			const destinationReaction = reaction.data as ReactionCollectorChooseDestinationReaction;

			// If the trip duration is hidden, the translation module is used with a 2 hours placeholder and the 2 is replaced by a ? afterward
			const duration = destinationReaction.tripDuration
				? minutesDisplayIntl(destinationReaction.tripDuration, lng)
				: minutesDisplayIntl(120, lng)
					.replace("2", "?");
			return `${
				CrowniclesIcons.mapTypes[destinationReaction.mapTypeId]
			} ${destinationReaction.enterInCity
				? i18n.t("commands:report.city.enterIn", {
					lng, mapLocationId: destinationReaction.mapId
				})
				: ""}${
				i18n.t(`models:map_locations.${destinationReaction.mapId}.name`, { lng })} ${destinationReaction.enterInCity ? "" : `(${duration})`}`;
		})
	}, {
		refuse: { can: false },
		deferUpdate: true
	});
}

export async function stayInCity(context: PacketContext): Promise<void> {
	const lng = context.discord!.language!;
	const interaction = DiscordCache.getInteraction(context.discord!.interaction!)!;
	const embed = new CrowniclesEmbed()
		.formatAuthor(i18n.t("commands:report.city.stayTitle", {
			pseudo: await DisplayUtils.getEscapedUsername(context.keycloakId!, lng),
			lng
		}), interaction.user)
		.setDescription(i18n.t("commands:report.city.stayDescription", {
			lng
		}));
	await interaction.followUp({
		embeds: [embed]
	});
}

export async function handleChooseDestinationCity(packet: CommandReportChooseDestinationCityRes, context: PacketContext): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction);
	if (!interaction) {
		return;
	}
	const lng = interaction.userLanguage;

	const embed = new CrowniclesEmbed();
	embed.formatAuthor(i18n.t("commands:report.destinationTitle", {
		lng,
		pseudo: await DisplayUtils.getEscapedUsername(context.keycloakId!, lng)
	}), interaction.user);
	embed.setDescription(i18n.t("commands:report.city.destination", {
		lng,
		mapLocationId: packet.mapId,
		mapTypeId: packet.mapTypeId
	}));

	await interaction.followUp({
		embeds: [embed]
	});
}

export const commandInfo: ICommand = {
	slashCommandBuilder: SlashCommandBuilderGenerator.generateBaseCommand("report"),
	getPacket,
	mainGuildCommand: false
};
