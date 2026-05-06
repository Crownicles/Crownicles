import {
	CrowniclesNestedMenu,
	CrowniclesNestedMenuCollector,
	CrowniclesNestedMenus
} from "../../../messages/CrowniclesNestedMenus";
import i18n from "../../../translations/i18n";
import { DisplayUtils } from "../../../utils/DisplayUtils";
import { CrowniclesInteraction } from "../../../messages/CrowniclesInteraction";
import {
	makePacket, PacketContext
} from "../../../../../Lib/src/packets/CrowniclesPacket";
import {
	ReactionCollectorCityBuyHomeReaction,
	ReactionCollectorCityData,
	ReactionCollectorCityMoveHomeReaction,
	ReactionCollectorCityShopReaction,
	ReactionCollectorCityUpgradeHomeReaction,
	ReactionCollectorEnchantReaction,
	ReactionCollectorExitCityReaction,
	ReactionCollectorGuildDomainNotaryReaction,
	ReactionCollectorInnMealReaction,
	ReactionCollectorInnRoomReaction,
	EnchanterCityData
} from "../../../../../Lib/src/packets/interaction/ReactionCollectorCity";
import {
	ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, Message,
	MessageComponentInteraction, SectionBuilder, SeparatorBuilder,
	SeparatorSpacingSize,
	TextDisplayBuilder
} from "discord.js";
import { CrowniclesIcons } from "../../../../../Lib/src/CrowniclesIcons";
import {
	ReactionCollectorCreationPacket,
	ReactionCollectorReaction,
	ReactionCollectorRefuseReaction
} from "../../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { DiscordCache } from "../../../bot/DiscordCache";
import { sendInteractionNotForYou } from "../../../utils/ErrorUtils";
import { DiscordCollectorUtils } from "../../../utils/DiscordCollectorUtils";
import { ReactionCollectorReturnTypeOrNull } from "../../../packetHandlers/handlers/ReactionCollectorHandlers";
import { PacketUtils } from "../../../utils/PacketUtils";
import { ReactionCollectorResetTimerPacketReq } from "../../../../../Lib/src/packets/interaction/ReactionCollectorResetTimer";
import {
	asMilliseconds, millisecondsToSeconds
} from "../../../../../Lib/src/utils/TimeUtils";
import {
	ChestSlotsPerCategory, HomeFeatures
} from "../../../../../Lib/src/types/HomeFeatures";
import { Language } from "../../../../../Lib/src/Language";
import { ItemRarity } from "../../../../../Lib/src/constants/ItemConstants";
import {
	getHomeMenu, getHomeSubMenus, HomeMenuIds
} from "./home";
import { HomeMenuParams } from "./home/HomeMenuTypes";
import { getBlacksmithMenus } from "./blacksmith/BlacksmithMenu";
import { ReportCityMenuIds } from "./ReportCityMenuConstants";
import {
	getGuildDomainMenu, getGuildDomainSubMenus
} from "./guildDomain/GuildDomainMenu";
import { getGuildFoodShopMenu } from "./guildFoodShop/GuildFoodShopMenu";


type ManageHomeData = NonNullable<ReactionCollectorCityData["home"]["manage"]>;

type CityCollectorHandler = (
	customId: string,
	buttonInteraction: MessageComponentInteraction,
	nestedMenus: CrowniclesNestedMenus
) => Promise<void>;

/**
 * Creates a standard collector factory for city sub-menus.
 * Handles user ID validation and routes button interactions to the provided handler.
 */
export function createCityCollector(
	interaction: CrowniclesInteraction,
	collectorTime: number,
	handler: CityCollectorHandler
): (nestedMenus: CrowniclesNestedMenus, message: Message) => CrowniclesNestedMenuCollector {
	const lng = interaction.userLanguage;

	return (nestedMenus, message): CrowniclesNestedMenuCollector => {
		const collector = message.createMessageComponentCollector({ time: collectorTime });

		collector.on("collect", async (buttonInteraction: MessageComponentInteraction) => {
			if (buttonInteraction.user.id !== interaction.user.id) {
				await sendInteractionNotForYou(buttonInteraction.user, buttonInteraction, lng);
				return;
			}

			await handler(buttonInteraction.customId, buttonInteraction, nestedMenus);
		});

		return collector;
	};
}

/**
 * Get the description for the manage home option in the main menu
 */
function getManageHomeMenuOptionDescription(manage: ManageHomeData, lng: Language): string {
	if (manage.newPrice) {
		return i18n.t("commands:report.city.homes.manageHomeDescriptionNew", { lng });
	}
	if (manage.upgrade) {
		return i18n.t("commands:report.city.homes.manageHomeDescriptionUpgrade", { lng });
	}
	if (manage.movePrice) {
		return i18n.t("commands:report.city.homes.manageHomeDescriptionMove", { lng });
	}
	if (manage.isMaxLevel) {
		return i18n.t("commands:report.city.homes.manageHomeDescriptionMaxLevel", { lng });
	}
	if (manage.requiredPlayerLevelForUpgrade) {
		return i18n.t("commands:report.city.homes.manageHomeDescriptionLevelRequired", {
			lng,
			level: manage.requiredPlayerLevelForUpgrade
		});
	}
	return i18n.t("commands:report.city.homes.manageHomeDescriptionUnavailable", { lng });
}

type AddCitySectionBaseParams = {
	container: ContainerBuilder;
	customId: string;
	buttonLabel: string;
	buttonStyle?: ButtonStyle;
};

type AddCitySectionWithTitle = AddCitySectionBaseParams & {
	emote: string;
	title: string;
	description?: string;
};

type AddCitySectionWithText = AddCitySectionBaseParams & {
	text: string;
	emoji?: string;
};

export type AddCitySectionParams = AddCitySectionWithTitle | AddCitySectionWithText;

export function addCitySection(params: AddCitySectionParams): void {
	let text: string;
	let emoji: string | undefined;

	if ("title" in params) {
		text = params.description
			? `${params.emote} **${params.title}**\n${params.description}`
			: `${params.emote} **${params.title}**`;
		emoji = params.emote;
	}
	else {
		text = params.text;
		emoji = params.emoji;
	}

	const button = new ButtonBuilder()
		.setCustomId(params.customId)
		.setLabel(params.buttonLabel)
		.setStyle(params.buttonStyle ?? ButtonStyle.Secondary);

	if (emoji) {
		button.setEmoji(emoji);
	}

	params.container.addSectionComponents(
		new SectionBuilder()
			.addTextDisplayComponents(new TextDisplayBuilder().setContent(text))
			.setButtonAccessory(button)
	);
}

/**
 * Create a "stay in city" button for use in sub-menu action rows
 */
export function createStayInCityButton(lng: Language): ButtonBuilder {
	return new ButtonBuilder()
		.setCustomId(ReportCityMenuIds.STAY_IN_CITY)
		.setLabel(i18n.t("commands:report.city.reactions.stay.label", { lng }))
		.setEmoji(CrowniclesIcons.city.stay)
		.setStyle(ButtonStyle.Secondary);
}

/**
 * Handle the "stay in city" button click from any sub-menu.
 * Sends the refuse reaction to end the city interaction.
 */
export function handleStayInCityInteraction(
	packet: ReactionCollectorCreationPacket,
	context: PacketContext,
	componentInteraction: MessageComponentInteraction
): void {
	const reactionIndex = packet.reactions.findIndex(
		reaction => reaction.type === ReactionCollectorRefuseReaction.name
	);
	if (reactionIndex !== -1) {
		DiscordCollectorUtils.sendReaction(packet, context, context.keycloakId!, componentInteraction, reactionIndex);
	}
}

function shouldShowHomeSection(data: ReactionCollectorCityData): boolean {
	return Boolean(data.home.owned) || shouldShowManageHomeMenu(data);
}

function addHomeSection(container: ContainerBuilder, data: ReactionCollectorCityData, lng: Language): void {
	if (!shouldShowHomeSection(data)) {
		return;
	}
	container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

	if (data.home.owned) {
		addCitySection({
			container,
			emote: CrowniclesIcons.city.home[data.home.owned.level],
			title: i18n.t("commands:report.city.homes.goToOwnedHome", { lng }),
			description: i18n.t("commands:report.city.homes.goToOwnedHomeDescription", { lng }),
			customId: HomeMenuIds.HOME_MENU,
			buttonLabel: i18n.t("commands:report.city.buttons.goHome", { lng }),
			buttonStyle: ButtonStyle.Primary
		});
	}

	if (shouldShowManageHomeMenu(data)) {
		addCitySection({
			container,
			emote: CrowniclesIcons.city.manageHome,
			title: i18n.t("commands:report.city.homes.manageHome", { lng }),
			description: data.home.manage ? getManageHomeMenuOptionDescription(data.home.manage, lng) : undefined,
			customId: HomeMenuIds.MANAGE_HOME_MENU,
			buttonLabel: i18n.t("commands:report.city.buttons.seeNotary", { lng })
		});
	}
}

function addServicesSection(container: ContainerBuilder, data: ReactionCollectorCityData, lng: Language): void {
	if (!data.blacksmith && !data.enchanter) {
		return;
	}
	container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

	if (data.blacksmith) {
		addCitySection({
			container,
			emote: CrowniclesIcons.city.blacksmith.menu,
			title: i18n.t("commands:report.city.blacksmith.menuLabel", { lng }),
			description: i18n.t("commands:report.city.blacksmith.menuDescription", { lng }),
			customId: ReportCityMenuIds.BLACKSMITH_MENU,
			buttonLabel: i18n.t("commands:report.city.buttons.enterForge", { lng })
		});
	}

	if (data.enchanter) {
		addCitySection({
			container,
			emote: CrowniclesIcons.city.enchanter,
			title: i18n.t("commands:report.city.reactions.enchanter.label", { lng }),
			description: i18n.t("commands:report.city.reactions.enchanter.description", { lng }),
			customId: ReportCityMenuIds.ENCHANTER_MENU,
			buttonLabel: i18n.t("commands:report.city.buttons.talkToEnchanter", { lng })
		});
	}
}

function addShopsSection(container: ContainerBuilder, data: ReactionCollectorCityData, lng: Language): void {
	if (!data.shops || data.shops.length === 0) {
		return;
	}
	container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

	for (const shop of data.shops) {
		const shopEmoji = CrowniclesIcons.city.shops[shop.shopId] ?? CrowniclesIcons.city.shops.generalShop;
		addCitySection({
			container,
			emote: shopEmoji,
			title: i18n.t(`commands:report.city.shops.${shop.shopId}.label`, { lng }),
			description: i18n.t(`commands:report.city.shops.${shop.shopId}.description`, { lng }),
			customId: `${ReportCityMenuIds.CITY_SHOP_PREFIX}${shop.shopId}`,
			buttonLabel: i18n.t("commands:report.city.buttons.browseShop", { lng })
		});
	}
}

function addInnsSection(container: ContainerBuilder, data: ReactionCollectorCityData, lng: Language): void {
	if (!data.inns || data.inns.length === 0) {
		return;
	}
	container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

	for (const inn of data.inns) {
		addCitySection({
			container,
			emote: CrowniclesIcons.city.inn,
			title: i18n.t("commands:report.city.reactions.inn.label", {
				lng, innId: inn.innId
			}),
			description: i18n.t("commands:report.city.reactions.inn.description", { lng }),
			customId: `${ReportCityMenuIds.MAIN_MENU_INN_PREFIX}${inn.innId}`,
			buttonLabel: i18n.t("commands:report.city.buttons.sitDown", { lng })
		});
	}
}

function addGuildDomainSection(container: ContainerBuilder, data: ReactionCollectorCityData, lng: Language): void {
	if (!data.guildDomain?.isInCity) {
		return;
	}
	container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

	addCitySection({
		container,
		emote: CrowniclesIcons.city.guildDomain.menu,
		title: i18n.t("commands:report.city.guildDomain.label", { lng }),
		description: i18n.t("commands:report.city.guildDomain.description", {
			lng,
			guildName: data.guildDomain.guildName
		}),
		customId: ReportCityMenuIds.GUILD_DOMAIN_MENU,
		buttonLabel: i18n.t("commands:report.city.buttons.visitDomain", { lng }),
		buttonStyle: ButtonStyle.Primary
	});
}

function addGuildFoodShopSection(container: ContainerBuilder, data: ReactionCollectorCityData, lng: Language): void {
	if (!data.guildFoodShop) {
		return;
	}
	container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
	addCitySection({
		container,
		emote: CrowniclesIcons.expedition.food,
		title: i18n.t("commands:report.city.guildFoodShop.label", { lng }),
		description: i18n.t("commands:report.city.guildFoodShop.description", {
			lng,
			guildName: data.guildFoodShop.guildName
		}),
		customId: ReportCityMenuIds.GUILD_FOOD_SHOP_MENU,
		buttonLabel: i18n.t("commands:report.city.buttons.visitFoodShop", { lng }),
		buttonStyle: ButtonStyle.Secondary
	});
}

function addExitStayButtons(container: ContainerBuilder, packet: ReactionCollectorCreationPacket, lng: Language): void {
	container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
	const actionRow = new ActionRowBuilder<ButtonBuilder>();

	const reactionButtonMap: Record<string, () => ButtonBuilder> = {
		[ReactionCollectorExitCityReaction.name]: () => new ButtonBuilder()
			.setCustomId(ReportCityMenuIds.MAIN_MENU_EXIT_CITY)
			.setLabel(i18n.t("commands:report.city.reactions.exit.label", { lng }))
			.setEmoji(CrowniclesIcons.city.exit)
			.setStyle(ButtonStyle.Danger),
		[ReactionCollectorRefuseReaction.name]: () => new ButtonBuilder()
			.setCustomId(ReportCityMenuIds.MAIN_MENU_STAY_CITY)
			.setLabel(i18n.t("commands:report.city.reactions.stay.label", { lng }))
			.setEmoji(CrowniclesIcons.city.stay)
			.setStyle(ButtonStyle.Secondary)
	};

	for (const reaction of packet.reactions) {
		const buttonFactory = reactionButtonMap[reaction.type];
		if (buttonFactory) {
			actionRow.addComponents(buttonFactory());
		}
	}

	container.addActionRowComponents(actionRow);
}

function getMainMenu(context: PacketContext, interaction: CrowniclesInteraction, packet: ReactionCollectorCreationPacket, collectorTime: number, pseudo: string): CrowniclesNestedMenu {
	const data = packet.data.data as ReactionCollectorCityData;
	const lng = interaction.userLanguage;

	const container = new ContainerBuilder();

	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent(
			`### ${i18n.t("commands:report.city.title", {
				lng, pseudo
			})}`
		)
	);

	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent(
			i18n.t("commands:report.city.description", {
				lng,
				mapLocationId: data.mapLocationId,
				mapTypeId: data.mapTypeId,
				enterCityTimestamp: millisecondsToSeconds(asMilliseconds(data.enterCityTimestamp))
			})
		)
	);

	addHomeSection(container, data, lng);
	addServicesSection(container, data, lng);
	addShopsSection(container, data, lng);
	addInnsSection(container, data, lng);
	addGuildDomainSection(container, data, lng);
	addGuildFoodShopSection(container, data, lng);
	addExitStayButtons(container, packet, lng);

	return {
		containers: [container],
		createCollector: createMainMenuCollector(context, interaction, packet, collectorTime)
	};
}

/**
 * Handle a main menu selection value. Returns true if handled.
 */
async function handleMainMenuSelection(
	selectedValue: string,
	nestedMenus: CrowniclesNestedMenus,
	componentInteraction: MessageComponentInteraction,
	context: PacketContext,
	packet: ReactionCollectorCreationPacket
): Promise<void> {
	// Simple navigation routes
	const navigationRoutes: Record<string, string> = {
		[ReportCityMenuIds.ENCHANTER_MENU]: ReportCityMenuIds.ENCHANTER_MENU,
		[HomeMenuIds.HOME_MENU]: HomeMenuIds.HOME_MENU,
		[HomeMenuIds.MANAGE_HOME_MENU]: HomeMenuIds.MANAGE_HOME_MENU,
		[ReportCityMenuIds.BLACKSMITH_MENU]: ReportCityMenuIds.BLACKSMITH_MENU,
		[ReportCityMenuIds.GUILD_DOMAIN_MENU]: ReportCityMenuIds.GUILD_DOMAIN_MENU,
		[ReportCityMenuIds.GUILD_FOOD_SHOP_MENU]: ReportCityMenuIds.GUILD_FOOD_SHOP_MENU
	};

	if (navigationRoutes[selectedValue]) {
		await nestedMenus.changeMenu(navigationRoutes[selectedValue]);
		return;
	}

	if (selectedValue.startsWith(ReportCityMenuIds.CITY_SHOP_PREFIX)) {
		const shopId = selectedValue.replace(ReportCityMenuIds.CITY_SHOP_PREFIX, "");
		const reactionIndex = packet.reactions.findIndex(
			reaction => reaction.type === ReactionCollectorCityShopReaction.name
				&& (reaction.data as ReactionCollectorCityShopReaction).shopId === shopId
		);
		if (reactionIndex !== -1) {
			DiscordCollectorUtils.sendReaction(packet, context, context.keycloakId!, componentInteraction, reactionIndex);
		}
		return;
	}

	if (selectedValue.startsWith(ReportCityMenuIds.MAIN_MENU_INN_PREFIX)) {
		const innId = selectedValue.replace(ReportCityMenuIds.MAIN_MENU_INN_PREFIX, "");
		await nestedMenus.changeMenu(`${ReportCityMenuIds.INN_PREFIX}${innId}`);
		return;
	}

	// Reaction-based actions
	const reactionRoutes: Record<string, string> = {
		[ReportCityMenuIds.MAIN_MENU_EXIT_CITY]: ReactionCollectorExitCityReaction.name,
		[ReportCityMenuIds.MAIN_MENU_STAY_CITY]: ReactionCollectorRefuseReaction.name
	};

	if (reactionRoutes[selectedValue]) {
		const reactionIndex = packet.reactions.findIndex(reaction => reaction.type === reactionRoutes[selectedValue]);
		if (reactionIndex !== -1) {
			DiscordCollectorUtils.sendReaction(packet, context, context.keycloakId!, componentInteraction, reactionIndex);
		}
	}
}

/**
 * Create the collector for the main city menu.
 */
function createMainMenuCollector(
	context: PacketContext,
	interaction: CrowniclesInteraction,
	packet: ReactionCollectorCreationPacket,
	collectorTime: number
): (nestedMenus: CrowniclesNestedMenus, message: Message) => CrowniclesNestedMenuCollector {
	return createCityCollector(interaction, collectorTime, async (customId, buttonInteraction, nestedMenus) => {
		await buttonInteraction.deferUpdate();
		await handleMainMenuSelection(customId, nestedMenus, buttonInteraction, context, packet);
	});
}

function getInnMenu(
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

/**
 * Create the collector for an inn sub-menu.
 */
function createInnMenuCollector(
	context: PacketContext,
	interaction: CrowniclesInteraction,
	packet: ReactionCollectorCreationPacket,
	innId: string,
	collectorTime: number
): (nestedMenus: CrowniclesNestedMenus, message: import("discord.js").Message) => CrowniclesNestedMenuCollector {
	return createCityCollector(interaction, collectorTime, async (customId, buttonInteraction, nestedMenus) => {
		await handleInnCollectorInteraction(customId, buttonInteraction, nestedMenus, context, packet, innId);
	});
}

function getEnchanterMenu(context: PacketContext, interaction: CrowniclesInteraction, packet: ReactionCollectorCreationPacket, collectorTime: number, pseudo: string): CrowniclesNestedMenu {
	const data = (packet.data.data as ReactionCollectorCityData).enchanter!;
	const lng = interaction.userLanguage;

	const container = new ContainerBuilder();

	// Title
	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent(
			`### ${i18n.t("commands:report.city.enchanter.title", {
				lng, pseudo
			})}`
		)
	);

	// Story
	if (data.enchantableItems.length === 0) {
		container.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(
				i18n.t("commands:report.city.enchanter.emptyInventoryStory", { lng })
			)
		);
	}
	else {
		let desc = `${i18n.t("commands:report.city.enchanter.story", { lng })}\n\n`;
		const price = data.enchantmentCost.gems === 0
			? i18n.t("commands:report.city.enchanter.priceMoneyOnly", {
				lng, money: data.enchantmentCost.money
			})
			: i18n.t("commands:report.city.enchanter.priceMoneyAndGems", {
				lng, money: data.enchantmentCost.money, gems: data.enchantmentCost.gems
			});
		if (data.mageReduction) {
			desc += i18n.t("commands:report.city.enchanter.enchantmentWithReduction", {
				lng,
				price,
				enchantmentId: data.enchantmentId,
				enchantmentType: data.enchantmentType
			});
		}
		else {
			desc += i18n.t("commands:report.city.enchanter.enchantmentNoReduction", {
				lng,
				price,
				enchantmentId: data.enchantmentId,
				enchantmentType: data.enchantmentType
			});
		}
		if (data.hasAtLeastOneEnchantedItem) {
			desc += `\n\n${i18n.t("commands:report.city.enchanter.hasAtLeastOneEnchantedItem", { lng })}`;
		}
		container.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(desc)
		);

		// Enchantable items
		for (let i = 0; i < data.enchantableItems.length; i++) {
			const item = data.enchantableItems[i];
			const itemDisplay = DisplayUtils.getItemDisplayWithStatsWithoutMaxValues(item.details, lng);

			container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
			addCitySection({
				container,
				text: itemDisplay,
				customId: `${ReportCityMenuIds.ENCHANT_ITEM_PREFIX}${i}`,
				buttonLabel: i18n.t("commands:report.city.buttons.enchant", { lng })
			});
		}
	}

	// Back to city + Stay in city buttons
	container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
	container.addActionRowComponents(
		new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder()
				.setCustomId(ReportCityMenuIds.BACK_TO_CITY)
				.setLabel(i18n.t("commands:report.city.enchanter.leave", { lng }))
				.setEmoji(CrowniclesIcons.city.exit)
				.setStyle(ButtonStyle.Secondary),
			createStayInCityButton(lng)
		)
	);

	return {
		containers: [container],
		createCollector: createEnchanterMenuCollector(context, interaction, packet, data, collectorTime)
	};
}

/**
 * Create the collector for the enchanter sub-menu.
 */
async function handleEnchanterCollectorInteraction(
	selectedValue: string,
	buttonInteraction: MessageComponentInteraction,
	nestedMenus: CrowniclesNestedMenus,
	context: PacketContext,
	packet: ReactionCollectorCreationPacket,
	data: EnchanterCityData
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

	if (!selectedValue.startsWith(ReportCityMenuIds.ENCHANT_ITEM_PREFIX)) {
		return;
	}

	await buttonInteraction.deferReply();
	const index = parseInt(selectedValue.replace(ReportCityMenuIds.ENCHANT_ITEM_PREFIX, ""), 10);
	if (index < 0 || index >= data.enchantableItems.length) {
		return;
	}

	const slot = data.enchantableItems[index].slot;
	const itemCategory = data.enchantableItems[index].category;
	const reactionIndex = packet.reactions.findIndex(
		reaction => reaction.type === ReactionCollectorEnchantReaction.name
			&& (reaction.data as ReactionCollectorEnchantReaction).slot === slot
			&& (reaction.data as ReactionCollectorEnchantReaction).itemCategory === itemCategory
	);
	if (reactionIndex !== -1) {
		DiscordCollectorUtils.sendReaction(packet, context, context.keycloakId!, buttonInteraction, reactionIndex);
	}
}

function createEnchanterMenuCollector(
	context: PacketContext,
	interaction: CrowniclesInteraction,
	packet: ReactionCollectorCreationPacket,
	data: EnchanterCityData,
	collectorTime: number
): (nestedMenus: CrowniclesNestedMenus, message: import("discord.js").Message) => CrowniclesNestedMenuCollector {
	return createCityCollector(interaction, collectorTime, async (customId, buttonInteraction, nestedMenus) => {
		await handleEnchanterCollectorInteraction(customId, buttonInteraction, nestedMenus, context, packet, data);
	});
}

function hasSlotsChanged(oldSlots: ChestSlotsPerCategory, newSlots: ChestSlotsPerCategory): boolean {
	return oldSlots.weapon !== newSlots.weapon
		|| oldSlots.armor !== newSlots.armor
		|| oldSlots.object !== newSlots.object
		|| oldSlots.potion !== newSlots.potion;
}

function totalSlots(slots: ChestSlotsPerCategory): number {
	return slots.weapon + slots.armor + slots.object + slots.potion;
}

interface UpgradeCheck {
	hasChanged: (oldF: HomeFeatures, newF: HomeFeatures) => boolean;
	isNew: (oldF: HomeFeatures) => boolean;
	newKey: string;
	upgradeKey: string;
}

const UPGRADE_CHECKS: UpgradeCheck[] = [
	{
		hasChanged: (o, n): boolean => hasSlotsChanged(o.chestSlots, n.chestSlots),
		isNew: (o): boolean => totalSlots(o.chestSlots) === 0,
		newKey: "chest",
		upgradeKey: "biggerChest"
	},
	{
		hasChanged: (o, n): boolean => hasSlotsChanged(o.inventoryBonus, n.inventoryBonus),
		isNew: (): boolean => false,
		newKey: "inventoryBonus",
		upgradeKey: "inventoryBonus"
	},
	{
		hasChanged: (o, n): boolean => o.upgradeItemMaximumRarity !== n.upgradeItemMaximumRarity,
		isNew: (o): boolean => o.upgradeItemMaximumRarity === ItemRarity.BASIC,
		newKey: "upgradeItemStation",
		upgradeKey: "betterUpgradeItemStation"
	},
	{
		hasChanged: (o, n): boolean => o.bedHealthRegeneration !== n.bedHealthRegeneration,
		isNew: (): boolean => false,
		newKey: "betterBed",
		upgradeKey: "betterBed"
	},
	{
		hasChanged: (o, n): boolean => o.gardenPlots !== n.gardenPlots,
		isNew: (o): boolean => o.gardenPlots === 0,
		newKey: "garden",
		upgradeKey: "biggerGarden"
	},
	{
		hasChanged: (o, n): boolean => o.gardenEarthQuality !== n.gardenEarthQuality,
		isNew: (): boolean => false,
		newKey: "betterGardenEarth",
		upgradeKey: "betterGardenEarth"
	},
	{
		hasChanged: (o, n): boolean => o.cookingSlots !== n.cookingSlots,
		isNew: (o): boolean => o.cookingSlots === 0,
		newKey: "cookingStation",
		upgradeKey: "betterCookingStation"
	}
];

const formatHomeUpgradeChanges = (oldFeatures: HomeFeatures, newFeatures: HomeFeatures, lng: Language): string => {
	const changes: string[] = [];

	for (const check of UPGRADE_CHECKS) {
		if (check.hasChanged(oldFeatures, newFeatures)) {
			const key = check.isNew(oldFeatures) ? check.newKey : check.upgradeKey;
			changes.push(i18n.t(`commands:report.city.homes.upgradeChanges.${key}`, { lng }));
		}
	}

	return changes.map(change => `- ${change}`).join("\n");
};

/**
 * Build the notary description text based on available home actions
 */
function buildNotaryDescription(data: ManageHomeData, lng: Language): string {
	if (data.newPrice) {
		return data.newPrice > data.currentMoney
			? i18n.t("commands:report.city.homes.notaryNewHomeNoMoney", {
				lng,
				cost: data.newPrice,
				missingMoney: data.newPrice - data.currentMoney
			})
			: i18n.t("commands:report.city.homes.notaryNewHomeEnoughMoney", {
				lng,
				cost: data.newPrice
			});
	}
	if (data.upgrade) {
		if (data.upgrade.price > data.currentMoney) {
			return i18n.t("commands:report.city.homes.notaryUpgradeHomeNoMoney", {
				lng,
				cost: data.upgrade.price,
				missingMoney: data.upgrade.price - data.currentMoney
			});
		}
		const upgradeChanges = formatHomeUpgradeChanges(data.upgrade.oldFeatures, data.upgrade.newFeatures, lng);
		return i18n.t("commands:report.city.homes.notaryUpgradeHomeEnoughMoney", {
			lng,
			cost: data.upgrade.price,
			upgradeChanges
		});
	}
	if (data.movePrice) {
		return data.movePrice > data.currentMoney
			? i18n.t("commands:report.city.homes.notaryMoveHomeNoMoney", {
				lng,
				cost: data.movePrice,
				missingMoney: data.movePrice - data.currentMoney
			})
			: i18n.t("commands:report.city.homes.notaryMoveHomeEnoughMoney", {
				lng,
				cost: data.movePrice
			});
	}
	if (data.requiredPlayerLevelForUpgrade) {
		return i18n.t("commands:report.city.homes.notaryLevelRequired", {
			lng,
			level: data.requiredPlayerLevelForUpgrade
		});
	}
	if (data.isMaxLevel) {
		return i18n.t("commands:report.city.homes.notaryMaxLevel", { lng });
	}
	console.warn("Manage home menu opened without any available action");
	return "";
}

/**
 * Add the appropriate action button to the notary container
 */
function addNotaryActionButton(container: ContainerBuilder, data: ManageHomeData, lng: Language): void {
	if (data.newPrice && data.newPrice <= data.currentMoney) {
		container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
		addCitySection({
			container,
			emote: CrowniclesIcons.collectors.accept,
			title: i18n.t("commands:report.city.homes.buyHome", { lng }),
			customId: ReportCityMenuIds.BUY_HOME,
			buttonLabel: i18n.t("commands:report.city.buttons.confirm", { lng }),
			buttonStyle: ButtonStyle.Success
		});
	}
	else if (data.upgrade && data.upgrade.price <= data.currentMoney) {
		container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
		addCitySection({
			container,
			emote: CrowniclesIcons.collectors.accept,
			title: i18n.t("commands:report.city.homes.upgradeHome", { lng }),
			customId: ReportCityMenuIds.UPGRADE_HOME,
			buttonLabel: i18n.t("commands:report.city.buttons.confirm", { lng }),
			buttonStyle: ButtonStyle.Success
		});
	}
	else if (data.movePrice && data.movePrice <= data.currentMoney) {
		container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
		addCitySection({
			container,
			emote: CrowniclesIcons.collectors.accept,
			title: i18n.t("commands:report.city.homes.moveHome", { lng }),
			customId: ReportCityMenuIds.MOVE_HOME,
			buttonLabel: i18n.t("commands:report.city.buttons.confirm", { lng }),
			buttonStyle: ButtonStyle.Success
		});
	}
}

function addPersonalNotarySection(container: ContainerBuilder, homeData: ManageHomeData | undefined, lng: Language): void {
	if (!homeData) {
		return;
	}
	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent(
			`${i18n.t("commands:report.city.homes.notaryIntroduction", { lng })}\n\n${buildNotaryDescription(homeData, lng)}`
		)
	);
	addNotaryActionButton(container, homeData, lng);
}

type GuildNotaryData = NonNullable<ReactionCollectorCityData["guildDomainNotary"]>;

function buildGuildNotaryConfirmLabel(guildNotaryData: GuildNotaryData, lng: Language): string {
	const actionLabel = guildNotaryData.hasDomain
		? i18n.t("commands:report.city.guildDomain.confirmRelocate", { lng })
		: i18n.t("commands:report.city.guildDomain.confirmPurchase", { lng });
	if (guildNotaryData.cost > 0) {
		return i18n.t("commands:report.city.guildDomain.notaryConfirmLabel", {
			lng, cost: guildNotaryData.cost
		});
	}
	return actionLabel;
}

function addGuildNotarySection(container: ContainerBuilder, guildNotaryData: GuildNotaryData | undefined, lng: Language): void {
	if (!guildNotaryData?.isChief) {
		return;
	}
	container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

	const descriptionKey = guildNotaryData.hasDomain
		? "commands:report.city.guildDomain.notaryRelocateDescription"
		: "commands:report.city.guildDomain.notaryPurchaseDescription";

	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent(
			i18n.t(descriptionKey, {
				lng,
				cost: guildNotaryData.cost,
				treasury: guildNotaryData.treasury
			})
		)
	);

	if (guildNotaryData.treasury < guildNotaryData.cost) {
		return;
	}
	const actionLabel = guildNotaryData.hasDomain
		? i18n.t("commands:report.city.guildDomain.confirmRelocate", { lng })
		: i18n.t("commands:report.city.guildDomain.confirmPurchase", { lng });
	addCitySection({
		container,
		text: buildGuildNotaryConfirmLabel(guildNotaryData, lng),
		emoji: CrowniclesIcons.city.guildDomainNotary,
		customId: ReportCityMenuIds.GUILD_DOMAIN_CONFIRM,
		buttonLabel: actionLabel,
		buttonStyle: ButtonStyle.Success
	});
}

function addNotaryNavigation(container: ContainerBuilder, lng: Language): void {
	container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
	container.addActionRowComponents(
		new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder()
				.setCustomId(ReportCityMenuIds.BACK_TO_CITY)
				.setLabel(i18n.t("commands:report.city.homes.leaveNotary", { lng }))
				.setEmoji(CrowniclesIcons.city.exit)
				.setStyle(ButtonStyle.Secondary),
			createStayInCityButton(lng)
		)
	);
}

function getManageHomeMenu(context: PacketContext, interaction: CrowniclesInteraction, packet: ReactionCollectorCreationPacket, collectorTime: number, pseudo: string): CrowniclesNestedMenu {
	const cityData = packet.data.data as ReactionCollectorCityData;
	const lng = interaction.userLanguage;
	const container = new ContainerBuilder();

	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent(
			`### ${i18n.t("commands:report.city.homes.notaryTitle", {
				lng, pseudo
			})}`
		)
	);

	addPersonalNotarySection(container, cityData.home.manage, lng);
	addGuildNotarySection(container, cityData.guildDomainNotary, lng);
	addNotaryNavigation(container, lng);

	return {
		containers: [container],
		createCollector: createManageHomeMenuCollector(context, interaction, packet, collectorTime)
	};
}

/**
 * Handle a manage home menu selection.
 */
async function sendReactionByType(
	buttonInteraction: MessageComponentInteraction,
	packet: ReactionCollectorCreationPacket,
	context: PacketContext,
	reactionType: string
): Promise<void> {
	await buttonInteraction.deferReply();
	const reactionIndex = packet.reactions.findIndex(reaction => reaction.type === reactionType);
	if (reactionIndex !== -1) {
		DiscordCollectorUtils.sendReaction(packet, context, context.keycloakId!, buttonInteraction, reactionIndex);
	}
}

async function handleManageHomeCollectorInteraction(
	selectedValue: string,
	buttonInteraction: MessageComponentInteraction,
	nestedMenus: CrowniclesNestedMenus,
	context: PacketContext,
	packet: ReactionCollectorCreationPacket
): Promise<void> {
	const homeActionRoutes: Record<string, string> = {
		[ReportCityMenuIds.BUY_HOME]: ReactionCollectorCityBuyHomeReaction.name,
		[ReportCityMenuIds.UPGRADE_HOME]: ReactionCollectorCityUpgradeHomeReaction.name,
		[ReportCityMenuIds.MOVE_HOME]: ReactionCollectorCityMoveHomeReaction.name,
		[ReportCityMenuIds.GUILD_DOMAIN_CONFIRM]: ReactionCollectorGuildDomainNotaryReaction.name
	};

	if (homeActionRoutes[selectedValue]) {
		await sendReactionByType(buttonInteraction, packet, context, homeActionRoutes[selectedValue]);
		return;
	}

	if (selectedValue === ReportCityMenuIds.BACK_TO_CITY) {
		await buttonInteraction.deferUpdate();
		await nestedMenus.changeToMainMenu();
		return;
	}

	if (selectedValue === ReportCityMenuIds.STAY_IN_CITY) {
		await buttonInteraction.deferUpdate();
		handleStayInCityInteraction(packet, context, buttonInteraction);
	}
}

/**
 * Create the collector for the manage home sub-menu.
 */
function createManageHomeMenuCollector(
	context: PacketContext,
	interaction: CrowniclesInteraction,
	packet: ReactionCollectorCreationPacket,
	collectorTime: number
): (nestedMenus: CrowniclesNestedMenus, message: import("discord.js").Message) => CrowniclesNestedMenuCollector {
	return createCityCollector(interaction, collectorTime, async (customId, buttonInteraction, nestedMenus) => {
		await handleManageHomeCollectorInteraction(customId, buttonInteraction, nestedMenus, context, packet);
	});
}

/**
 * Build the city sub-menus (inns, enchanter, home, manage home)
 */
function addGuildDomainSubMenus(menus: Map<string, CrowniclesNestedMenu>, params: HomeMenuParams, cityData: ReactionCollectorCityData): void {
	if (!cityData.guildDomain?.isInCity) {
		return;
	}
	menus.set(ReportCityMenuIds.GUILD_DOMAIN_MENU, getGuildDomainMenu(params));
	for (const [key, menu] of getGuildDomainSubMenus(params)) {
		menus.set(key, menu);
	}
}

function addInnSubMenus(menus: Map<string, CrowniclesNestedMenu>, params: HomeMenuParams, cityData: ReactionCollectorCityData): void {
	for (const inn of cityData.inns || []) {
		menus.set(`${ReportCityMenuIds.INN_PREFIX}${inn.innId}`, getInnMenu(params.context, params.interaction, params.packet, inn.innId, params.collectorTime, params.pseudo));
	}
}

function addEnchanterSubMenu(menus: Map<string, CrowniclesNestedMenu>, params: HomeMenuParams, cityData: ReactionCollectorCityData): void {
	if (!cityData.enchanter) {
		return;
	}
	menus.set(ReportCityMenuIds.ENCHANTER_MENU, getEnchanterMenu(params.context, params.interaction, params.packet, params.collectorTime, params.pseudo));
}

function addBlacksmithSubMenus(menus: Map<string, CrowniclesNestedMenu>, params: HomeMenuParams, cityData: ReactionCollectorCityData): void {
	if (!cityData.blacksmith) {
		return;
	}
	for (const [key, menu] of getBlacksmithMenus(params)) {
		menus.set(key, menu);
	}
}

function addHomeSubMenus(menus: Map<string, CrowniclesNestedMenu>, params: HomeMenuParams, cityData: ReactionCollectorCityData): void {
	if (!cityData.home.owned) {
		return;
	}
	menus.set(HomeMenuIds.HOME_MENU, getHomeMenu(params));
	for (const [key, menu] of getHomeSubMenus(params)) {
		menus.set(key, menu);
	}
}

function shouldShowManageHomeMenu(cityData: ReactionCollectorCityData): boolean {
	return Boolean(cityData.home.manage) || Boolean(cityData.guildDomainNotary?.isChief);
}

function addManageHomeSubMenu(menus: Map<string, CrowniclesNestedMenu>, params: HomeMenuParams, cityData: ReactionCollectorCityData): void {
	if (!shouldShowManageHomeMenu(cityData)) {
		return;
	}
	menus.set(HomeMenuIds.MANAGE_HOME_MENU, getManageHomeMenu(params.context, params.interaction, params.packet, params.collectorTime, params.pseudo));
}

function addGuildFoodShopSubMenu(menus: Map<string, CrowniclesNestedMenu>, params: HomeMenuParams, cityData: ReactionCollectorCityData): void {
	if (!cityData.guildFoodShop) {
		return;
	}
	menus.set(ReportCityMenuIds.GUILD_FOOD_SHOP_MENU, getGuildFoodShopMenu(params));
}

function buildCitySubMenus(params: HomeMenuParams): Map<string, CrowniclesNestedMenu> {
	const menus = new Map<string, CrowniclesNestedMenu>();
	const cityData = params.packet.data.data as ReactionCollectorCityData;

	addInnSubMenus(menus, params, cityData);
	addEnchanterSubMenu(menus, params, cityData);
	addBlacksmithSubMenus(menus, params, cityData);
	addHomeSubMenus(menus, params, cityData);
	addManageHomeSubMenu(menus, params, cityData);
	addGuildDomainSubMenus(menus, params, cityData);
	addGuildFoodShopSubMenu(menus, params, cityData);

	return menus;
}

export class ReportCityMenu {
	public static async handleCityCollector(context: PacketContext, packet: ReactionCollectorCreationPacket): Promise<ReactionCollectorReturnTypeOrNull> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);
		if (!interaction) {
			throw new Error("Interaction not found");
		}
		const collectorTime = packet.endTime - Date.now();
		const pseudo = await DisplayUtils.getEscapedUsername(context.keycloakId!, interaction.userLanguage);
		const menuParams = {
			context, interaction, packet, collectorTime, pseudo
		};

		const menus = buildCitySubMenus(menuParams);

		const nestedMenus = new CrowniclesNestedMenus(
			getMainMenu(context, interaction, packet, collectorTime, pseudo),
			menus,
			() => {
				PacketUtils.sendPacketToBackend(context, makePacket(ReactionCollectorResetTimerPacketReq, { reactionCollectorId: packet.id }));
			}
		);
		const msg = await nestedMenus.send(interaction);

		// Auto-navigate to initial menu if specified (e.g., after chest deposit/withdraw)
		const cityData = packet.data.data as ReactionCollectorCityData;
		if (cityData.initialMenu && menus.has(cityData.initialMenu)) {
			await nestedMenus.changeMenu(cityData.initialMenu);
		}

		const dummyCollector = msg.createReactionCollector();
		dummyCollector.on("end", async () => {
			await nestedMenus.stopCurrentCollector();
		});

		return [dummyCollector];
	}
}
