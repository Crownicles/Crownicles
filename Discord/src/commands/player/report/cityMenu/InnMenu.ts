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
import { Language } from "../../../../../../Lib/src/Language";
import {
	CrowniclesNestedMenu,
	CrowniclesNestedMenuCollector,
	CrowniclesNestedMenus
} from "../../../../messages/CrowniclesNestedMenus";
import i18n from "../../../../translations/i18n";
import { DiscordCollectorUtils } from "../../../../utils/DiscordCollectorUtils";
import {
	addCitySection,
	createCityCollector,
	createStayInCityButton,
	handleStayInCityInteraction
} from "../ReportCityMenu";
import { ReportCityMenuIds } from "../ReportCityMenuConstants";
import {
	CityCollectorHandlerParams, CityMenuParams
} from "../ReportCityMenuTypes";

type InnHandlerParams = CityCollectorHandlerParams & { innId: string };

type InnCollectorParams = Omit<CityMenuParams, "pseudo"> & { innId: string };

type InnMenuParams = CityMenuParams & { innId: string };

type InnReactionRoute = {
	prefix: string;
	reactionType: string;
	idMatches: (id: string, reaction: {
		type: string; data: ReactionCollectorReaction;
	}) => boolean;
};

function getInnReactionRoutes(innId: string): InnReactionRoute[] {
	return [
		{
			prefix: ReportCityMenuIds.MEAL_PREFIX,
			reactionType: ReactionCollectorInnMealReaction.name,
			idMatches: (mealId, reaction): boolean =>
				(reaction.data as ReactionCollectorInnMealReaction).meal.mealId === mealId
				&& (reaction.data as ReactionCollectorInnMealReaction).innId === innId
		},
		{
			prefix: ReportCityMenuIds.ROOM_PREFIX,
			reactionType: ReactionCollectorInnRoomReaction.name,
			idMatches: (roomId, reaction): boolean =>
				(reaction.data as ReactionCollectorInnRoomReaction).room.roomId === roomId
				&& (reaction.data as ReactionCollectorInnRoomReaction).innId === innId
		}
	];
}

async function handleInnReactionRoute(
	route: InnReactionRoute,
	selectedValue: string,
	buttonInteraction: MessageComponentInteraction,
	context: PacketContext,
	packet: ReactionCollectorCreationPacket
): Promise<void> {
	await buttonInteraction.deferReply();
	const id = selectedValue.replace(route.prefix, "");
	const reactionIndex = packet.reactions.findIndex(
		reaction => reaction.type === route.reactionType && route.idMatches(id, reaction)
	);
	if (reactionIndex !== -1) {
		DiscordCollectorUtils.sendReaction(packet, context, context.keycloakId!, buttonInteraction, reactionIndex);
	}
}

async function handleInnCollectorInteraction(params: InnHandlerParams): Promise<void> {
	const {
		selectedValue, buttonInteraction, nestedMenus, context, packet, innId
	} = params;

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

	const route = getInnReactionRoutes(innId).find(r => selectedValue.startsWith(r.prefix));
	if (route) {
		await handleInnReactionRoute(route, selectedValue, buttonInteraction, context, packet);
	}
}

function createInnMenuCollector(
	params: InnCollectorParams
): (nestedMenus: CrowniclesNestedMenus, message: Message) => CrowniclesNestedMenuCollector {
	const {
		context, interaction, packet, innId, collectorTime
	} = params;
	return createCityCollector(interaction, collectorTime, async (customId, buttonInteraction, nestedMenus) => {
		await handleInnCollectorInteraction({
			selectedValue: customId, buttonInteraction, nestedMenus, context, packet, innId
		});
	});
}

function addInnTitle(container: ContainerBuilder, lng: Language, pseudo: string): void {
	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent(
			`### ${i18n.t("commands:report.city.inns.embedTitle", {
				lng, pseudo
			})}`
		)
	);
}

function addInnStoryAndStats(
	container: ContainerBuilder,
	cityData: ReactionCollectorCityData,
	innId: string,
	lng: Language
): void {
	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent(
			`${i18n.t(`commands:report.city.inns.stories.${innId}`, { lng })}\n\n${i18n.t("commands:report.city.inns.storiesEnergyAndHealth", {
				lng,
				currentEnergy: cityData.energy.current,
				maxEnergy: cityData.energy.max,
				currentHealth: cityData.health.current,
				maxHealth: cityData.health.max
			})}`
		)
	);
}

function addMealSections(
	container: ContainerBuilder,
	meals: {
		mealId: string; price: number; energy: number;
	}[] | undefined,
	lng: Language
): void {
	for (const meal of meals ?? []) {
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
}

function addRoomSections(
	container: ContainerBuilder,
	rooms: {
		roomId: string; price: number; health: number;
	}[] | undefined,
	lng: Language
): void {
	if ((rooms?.length ?? 0) === 0) {
		return;
	}
	container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
	for (const room of rooms ?? []) {
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
}

function addInnNavigation(container: ContainerBuilder, lng: Language): void {
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
}

export function getInnMenu(params: InnMenuParams): CrowniclesNestedMenu {
	const cityData = params.packet.data.data as ReactionCollectorCityData;
	const lng = params.interaction.userLanguage;
	const inn = cityData.inns?.find(i => i.innId === params.innId);

	const container = new ContainerBuilder();
	addInnTitle(container, lng, params.pseudo);
	addInnStoryAndStats(container, cityData, params.innId, lng);
	addMealSections(container, inn?.meals, lng);
	addRoomSections(container, inn?.rooms, lng);
	addInnNavigation(container, lng);

	return {
		containers: [container],
		createCollector: createInnMenuCollector({
			context: params.context,
			interaction: params.interaction,
			packet: params.packet,
			innId: params.innId,
			collectorTime: params.collectorTime
		})
	};
}
