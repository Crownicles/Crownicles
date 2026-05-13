import {
	ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, Message,
	MessageComponentInteraction, SeparatorBuilder,
	SeparatorSpacingSize,
	TextDisplayBuilder
} from "discord.js";
import { PacketContext } from "../../../../../../Lib/src/packets/CrowniclesPacket";
import {
	ReactionCollectorCityData,
	ReactionCollectorInnMealReaction,
	ReactionCollectorInnRoomReaction
} from "../../../../../../Lib/src/packets/interaction/ReactionCollectorCity";
import {
	ReactionCollectorCreationPacket,
	ReactionCollectorReaction
} from "../../../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { CrowniclesIcons } from "../../../../../../Lib/src/CrowniclesIcons";
import {
	CrowniclesNestedMenu,
	CrowniclesNestedMenuCollector,
	CrowniclesNestedMenus
} from "../../../../messages/CrowniclesNestedMenus";
import { CrowniclesInteraction } from "../../../../messages/CrowniclesInteraction";
import i18n from "../../../../translations/i18n";
import { DiscordCollectorUtils } from "../../../../utils/DiscordCollectorUtils";
import {
	addCitySection,
	createCityCollector,
	createStayInCityButton,
	handleStayInCityInteraction
} from "../ReportCityMenu";
import { ReportCityMenuIds } from "../ReportCityMenuConstants";

async function handleInnCollectorInteraction(
	selectedValue: string,
	buttonInteraction: MessageComponentInteraction,
	nestedMenus: CrowniclesNestedMenus,
	context: PacketContext,
	packet: ReactionCollectorCreationPacket,
	innId: string
): Promise<void> {
	if (selectedValue === ReportCityMenuIds.BACK_TO_CITY) {
		await buttonInteraction.deferUpdate();
		await nestedMenus.changeToMainMenu();
		return;
	}

	if (selectedValue === ReportCityMenuIds.STAY_IN_CITY) {
		await buttonInteraction.deferUpdate();
		handleStayInCityInteraction(packet, context, buttonInteraction);
		return;
	}

	const innReactionRoutes: {
		prefix: string;
		reactionType: string;
		idExtractor: (id: string, reaction: {
			type: string;
			data: ReactionCollectorReaction;
		}) => boolean;
	}[] = [
		{
			prefix: ReportCityMenuIds.MEAL_PREFIX,
			reactionType: ReactionCollectorInnMealReaction.name,
			idExtractor: (mealId, reaction): boolean =>
				(reaction.data as ReactionCollectorInnMealReaction).meal.mealId === mealId
				&& (reaction.data as ReactionCollectorInnMealReaction).innId === innId
		},
		{
			prefix: ReportCityMenuIds.ROOM_PREFIX,
			reactionType: ReactionCollectorInnRoomReaction.name,
			idExtractor: (roomId, reaction): boolean =>
				(reaction.data as ReactionCollectorInnRoomReaction).room.roomId === roomId
				&& (reaction.data as ReactionCollectorInnRoomReaction).innId === innId
		}
	];

	for (const route of innReactionRoutes) {
		if (!selectedValue.startsWith(route.prefix)) {
			continue;
		}
		await buttonInteraction.deferReply();
		const id = selectedValue.replace(route.prefix, "");
		const reactionIndex = packet.reactions.findIndex(
			reaction => reaction.type === route.reactionType
				&& route.idExtractor(id, reaction)
		);
		if (reactionIndex !== -1) {
			DiscordCollectorUtils.sendReaction(packet, context, context.keycloakId!, buttonInteraction, reactionIndex);
		}
		return;
	}
}

function createInnMenuCollector(
	context: PacketContext,
	interaction: CrowniclesInteraction,
	packet: ReactionCollectorCreationPacket,
	innId: string,
	collectorTime: number
): (nestedMenus: CrowniclesNestedMenus, message: Message) => CrowniclesNestedMenuCollector {
	return createCityCollector(interaction, collectorTime, async (customId, buttonInteraction, nestedMenus) => {
		await handleInnCollectorInteraction(customId, buttonInteraction, nestedMenus, context, packet, innId);
	});
}

export function getInnMenu(
	context: PacketContext,
	interaction: CrowniclesInteraction,
	packet: ReactionCollectorCreationPacket,
	innId: string,
	collectorTime: number,
	pseudo: string
): CrowniclesNestedMenu {
	const data = packet.data.data as ReactionCollectorCityData;
	const lng = interaction.userLanguage;
	const inn = data.inns?.find(i => i.innId === innId);

	const container = new ContainerBuilder();

	// Title
	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent(
			`### ${i18n.t("commands:report.city.inns.embedTitle", {
				lng, pseudo
			})}`
		)
	);

	// Story + stats
	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent(
			`${i18n.t(`commands:report.city.inns.stories.${innId}`, { lng })}\n\n${i18n.t("commands:report.city.inns.storiesEnergyAndHealth", {
				lng,
				currentEnergy: data.energy.current,
				maxEnergy: data.energy.max,
				currentHealth: data.health.current,
				maxHealth: data.health.max
			})}`
		)
	);

	// Meals
	for (const meal of inn?.meals || []) {
		container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
		addCitySection({
			container,
			emote: CrowniclesIcons.meals[meal.mealId],
			title: i18n.t(`commands:report.city.inns.meals.${meal.mealId}`, { lng }),
			description: i18n.t("commands:report.city.inns.mealDescription", {
				lng,
				price: meal.price,
				energy: meal.energy
			}),
			customId: `${ReportCityMenuIds.MEAL_PREFIX}${meal.mealId}`,
			buttonLabel: i18n.t("commands:report.city.buttons.order", { lng })
		});
	}

	// Rooms
	if ((inn?.rooms?.length ?? 0) > 0) {
		container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
	}
	for (const room of inn?.rooms || []) {
		addCitySection({
			container,
			emote: CrowniclesIcons.rooms[room.roomId],
			title: i18n.t(`commands:report.city.inns.rooms.${room.roomId}`, { lng }),
			description: i18n.t("commands:report.city.inns.roomDescription", {
				lng,
				price: room.price,
				health: room.health
			}),
			customId: `${ReportCityMenuIds.ROOM_PREFIX}${room.roomId}`,
			buttonLabel: i18n.t("commands:report.city.buttons.rent", { lng })
		});
	}

	// Back to city + Stay in city buttons
	container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
	container.addActionRowComponents(
		new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder()
				.setCustomId(ReportCityMenuIds.BACK_TO_CITY)
				.setLabel(i18n.t("commands:report.city.exitInn", { lng }))
				.setEmoji(CrowniclesIcons.city.exit)
				.setStyle(ButtonStyle.Secondary),
			createStayInCityButton(lng)
		)
	);

	return {
		containers: [container],
		createCollector: createInnMenuCollector(context, interaction, packet, innId, collectorTime)
	};
}
