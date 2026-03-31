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
	ReactionCollectorInnMealReaction,
	ReactionCollectorInnRoomReaction
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
	ReactionCollectorRefuseReaction
} from "../../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { DiscordCache } from "../../../bot/DiscordCache";
import { sendInteractionNotForYou } from "../../../utils/ErrorUtils";
import { DiscordCollectorUtils } from "../../../utils/DiscordCollectorUtils";
import { ReactionCollectorReturnTypeOrNull } from "../../../packetHandlers/handlers/ReactionCollectorHandlers";
import { PacketUtils } from "../../../utils/PacketUtils";
import { ReactionCollectorResetTimerPacketReq } from "../../../../../Lib/src/packets/interaction/ReactionCollectorResetTimer";
import { millisecondsToSeconds } from "../../../../../Lib/src/utils/TimeUtils";
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

type ManageHomeData = NonNullable<ReactionCollectorCityData["home"]["manage"]>;

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

export function addCitySection(container: ContainerBuilder, text: string, customId: string, buttonLabel: string, buttonStyle: ButtonStyle = ButtonStyle.Secondary, emoji?: string): void {
	const button = new ButtonBuilder()
		.setCustomId(customId)
		.setLabel(buttonLabel)
		.setStyle(buttonStyle);

	if (emoji) {
		button.setEmoji(emoji);
	}

	container.addSectionComponents(
		new SectionBuilder()
			.addTextDisplayComponents(new TextDisplayBuilder().setContent(text))
			.setButtonAccessory(button)
	);
}

function getMainMenu(context: PacketContext, interaction: CrowniclesInteraction, packet: ReactionCollectorCreationPacket, collectorTime: number, pseudo: string): CrowniclesNestedMenu {
	const data = packet.data.data as ReactionCollectorCityData;
	const lng = interaction.userLanguage;

	const container = new ContainerBuilder();

	// Title
	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent(
			`### ${i18n.t("commands:report.city.title", {
				lng, pseudo
			})}`
		)
	);

	// Description
	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent(
			i18n.t("commands:report.city.description", {
				lng,
				mapLocationId: data.mapLocationId,
				mapTypeId: data.mapTypeId,
				enterCityTimestamp: millisecondsToSeconds(data.enterCityTimestamp)
			})
		)
	);

	// --- Home & Notary ---
	if (data.home.owned || data.home.manage) {
		container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

		if (data.home.owned) {
			addCitySection(
				container,
				`${CrowniclesIcons.city.home[data.home.owned.level]} **${i18n.t("commands:report.city.homes.goToOwnedHome", { lng })}**\n${i18n.t("commands:report.city.homes.goToOwnedHomeDescription", { lng })}`,
				HomeMenuIds.HOME_MENU,
				i18n.t("commands:report.city.buttons.goHome", { lng }),
				ButtonStyle.Primary,
				CrowniclesIcons.city.home[data.home.owned.level]
			);
		}

		if (data.home.manage) {
			addCitySection(
				container,
				`${CrowniclesIcons.city.manageHome} **${i18n.t("commands:report.city.homes.manageHome", { lng })}**\n${getManageHomeMenuOptionDescription(data.home.manage, lng)}`,
				HomeMenuIds.MANAGE_HOME_MENU,
				i18n.t("commands:report.city.buttons.seeNotary", { lng }),
				ButtonStyle.Secondary,
				CrowniclesIcons.city.manageHome
			);
		}
	}

	// --- Services (Blacksmith, Enchanter) ---
	if (data.blacksmith || data.enchanter) {
		container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

		if (data.blacksmith) {
			addCitySection(
				container,
				`${CrowniclesIcons.city.blacksmith.menu} **${i18n.t("commands:report.city.blacksmith.menuLabel", { lng })}**\n${i18n.t("commands:report.city.blacksmith.menuDescription", { lng })}`,
				"BLACKSMITH_MENU",
				i18n.t("commands:report.city.buttons.enterForge", { lng }),
				ButtonStyle.Secondary,
				CrowniclesIcons.city.blacksmith.menu
			);
		}

		if (data.enchanter) {
			addCitySection(
				container,
				`${CrowniclesIcons.city.enchanter} **${i18n.t("commands:report.city.reactions.enchanter.label", { lng })}**\n${i18n.t("commands:report.city.reactions.enchanter.description", { lng })}`,
				"ENCHANTER_MENU",
				i18n.t("commands:report.city.buttons.talkToEnchanter", { lng }),
				ButtonStyle.Secondary,
				CrowniclesIcons.city.enchanter
			);
		}
	}

	// --- Shops ---
	if (data.shops && data.shops.length > 0) {
		container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

		for (const shop of data.shops) {
			const shopEmoji = CrowniclesIcons.city.shops[shop.shopId] ?? CrowniclesIcons.city.shops.generalShop;
			addCitySection(
				container,
				`${shopEmoji} **${i18n.t(`commands:report.city.shops.${shop.shopId}.label`, { lng })}**\n${i18n.t(`commands:report.city.shops.${shop.shopId}.description`, { lng })}`,
				`CITY_SHOP_${shop.shopId}`,
				i18n.t("commands:report.city.buttons.browseShop", { lng }),
				ButtonStyle.Secondary,
				shopEmoji
			);
		}
	}

	// --- Inns ---
	if (data.inns && data.inns.length > 0) {
		container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

		for (const inn of data.inns) {
			addCitySection(
				container,
				`${CrowniclesIcons.city.inn} **${i18n.t("commands:report.city.reactions.inn.label", {
					lng, innId: inn.innId
				})}**\n${i18n.t("commands:report.city.reactions.inn.description", { lng })}`,
				`MAIN_MENU_INN_${inn.innId}`,
				i18n.t("commands:report.city.buttons.sitDown", { lng }),
				ButtonStyle.Secondary,
				CrowniclesIcons.city.inn
			);
		}
	}

	// --- Exit / Stay buttons ---
	container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
	const actionRow = new ActionRowBuilder<ButtonBuilder>();

	for (const reaction of packet.reactions) {
		if (reaction.type === ReactionCollectorExitCityReaction.name) {
			actionRow.addComponents(
				new ButtonBuilder()
					.setCustomId("MAIN_MENU_EXIT_CITY")
					.setLabel(i18n.t("commands:report.city.reactions.exit.label", { lng }))
					.setEmoji(CrowniclesIcons.city.exit)
					.setStyle(ButtonStyle.Danger)
			);
		}
		else if (reaction.type === ReactionCollectorRefuseReaction.name) {
			actionRow.addComponents(
				new ButtonBuilder()
					.setCustomId("MAIN_MENU_STAY_CITY")
					.setLabel(i18n.t("commands:report.city.reactions.stay.label", { lng }))
					.setEmoji(CrowniclesIcons.city.stay)
					.setStyle(ButtonStyle.Secondary)
			);
		}
	}

	container.addActionRowComponents(actionRow);

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
		ENCHANTER_MENU: "ENCHANTER_MENU",
		[HomeMenuIds.HOME_MENU]: HomeMenuIds.HOME_MENU,
		[HomeMenuIds.MANAGE_HOME_MENU]: HomeMenuIds.MANAGE_HOME_MENU,
		BLACKSMITH_MENU: "BLACKSMITH_MENU"
	};

	if (navigationRoutes[selectedValue]) {
		await nestedMenus.changeMenu(navigationRoutes[selectedValue]);
		return;
	}

	if (selectedValue.startsWith("CITY_SHOP_")) {
		const shopId = selectedValue.replace("CITY_SHOP_", "");
		const reactionIndex = packet.reactions.findIndex(
			reaction => reaction.type === ReactionCollectorCityShopReaction.name
				&& (reaction.data as ReactionCollectorCityShopReaction).shopId === shopId
		);
		if (reactionIndex !== -1) {
			DiscordCollectorUtils.sendReaction(packet, context, context.keycloakId!, componentInteraction, reactionIndex);
		}
		return;
	}

	if (selectedValue.startsWith("MAIN_MENU_INN_")) {
		const innId = selectedValue.replace("MAIN_MENU_INN_", "");
		await nestedMenus.changeMenu(`INN_${innId}`);
		return;
	}

	// Reaction-based actions
	const reactionRoutes: Record<string, string> = {
		MAIN_MENU_EXIT_CITY: ReactionCollectorExitCityReaction.name,
		MAIN_MENU_STAY_CITY: ReactionCollectorRefuseReaction.name
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
	const lng = interaction.userLanguage;

	return (nestedMenus, message): CrowniclesNestedMenuCollector => {
		const collector = message.createMessageComponentCollector({
			time: collectorTime
		});

		collector.on("collect", async (buttonInteraction: MessageComponentInteraction) => {
			if (buttonInteraction.user.id !== interaction.user.id) {
				await sendInteractionNotForYou(buttonInteraction.user, buttonInteraction, lng);
				return;
			}

			await buttonInteraction.deferUpdate();
			await handleMainMenuSelection(buttonInteraction.customId, nestedMenus, buttonInteraction, context, packet);
		});

		return collector;
	};
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
			`### ${i18n.t("commands:report.city.inns.embedTitle", { lng, pseudo })}`
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
		addCitySection(
			container,
			`${CrowniclesIcons.meals[meal.mealId]} **${i18n.t(`commands:report.city.inns.meals.${meal.mealId}`, { lng })}**\n${i18n.t("commands:report.city.inns.mealDescription", {
				lng,
				price: meal.price,
				energy: meal.energy
			})}`,
			`MEAL_${meal.mealId}`,
			i18n.t("commands:report.city.buttons.order", { lng }),
			ButtonStyle.Secondary,
			CrowniclesIcons.meals[meal.mealId]
		);
	}

	// Rooms
	if ((inn?.rooms?.length ?? 0) > 0) {
		container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
	}
	for (const room of inn?.rooms || []) {
		addCitySection(
			container,
			`${CrowniclesIcons.rooms[room.roomId]} **${i18n.t(`commands:report.city.inns.rooms.${room.roomId}`, { lng })}**\n${i18n.t("commands:report.city.inns.roomDescription", {
				lng,
				price: room.price,
				health: room.health
			})}`,
			`ROOM_${room.roomId}`,
			i18n.t("commands:report.city.buttons.rent", { lng }),
			ButtonStyle.Secondary,
			CrowniclesIcons.rooms[room.roomId]
		);
	}

	// Back to city button
	container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
	container.addActionRowComponents(
		new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder()
				.setCustomId("BACK_TO_CITY")
				.setLabel(i18n.t("commands:report.city.exitInn", { lng }))
				.setEmoji(CrowniclesIcons.city.exit)
				.setStyle(ButtonStyle.Secondary)
		)
	);

	return {
		containers: [container],
		createCollector: createInnMenuCollector(context, interaction, packet, innId, collectorTime)
	};
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
	const lng = interaction.userLanguage;

	return (nestedMenus, message): CrowniclesNestedMenuCollector => {
		const collector = message.createMessageComponentCollector({ time: collectorTime });

		collector.on("collect", async (buttonInteraction: MessageComponentInteraction) => {
			if (buttonInteraction.user.id !== interaction.user.id) {
				await sendInteractionNotForYou(buttonInteraction.user, buttonInteraction, lng);
				return;
			}

			const selectedValue = buttonInteraction.customId;

			if (selectedValue.startsWith("MEAL_")) {
				await buttonInteraction.deferReply();
				const mealId = selectedValue.replace("MEAL_", "");
				const reactionIndex = packet.reactions.findIndex(
					reaction => reaction.type === ReactionCollectorInnMealReaction.name
						&& (reaction.data as ReactionCollectorInnMealReaction).meal.mealId === mealId
						&& (reaction.data as ReactionCollectorInnMealReaction).innId === innId
				);
				if (reactionIndex !== -1) {
					DiscordCollectorUtils.sendReaction(packet, context, context.keycloakId!, buttonInteraction, reactionIndex);
				}
			}
			else if (selectedValue.startsWith("ROOM_")) {
				await buttonInteraction.deferReply();
				const roomId = selectedValue.replace("ROOM_", "");
				const reactionIndex = packet.reactions.findIndex(
					reaction => reaction.type === ReactionCollectorInnRoomReaction.name
						&& (reaction.data as ReactionCollectorInnRoomReaction).room.roomId === roomId
						&& (reaction.data as ReactionCollectorInnRoomReaction).innId === innId
				);
				if (reactionIndex !== -1) {
					DiscordCollectorUtils.sendReaction(packet, context, context.keycloakId!, buttonInteraction, reactionIndex);
				}
			}
			else if (selectedValue === "BACK_TO_CITY") {
				await buttonInteraction.deferUpdate();
				await nestedMenus.changeToMainMenu();
			}
		});

		return collector;
	};
}

function getEnchanterMenu(context: PacketContext, interaction: CrowniclesInteraction, packet: ReactionCollectorCreationPacket, collectorTime: number, pseudo: string): CrowniclesNestedMenu {
	const data = (packet.data.data as ReactionCollectorCityData).enchanter!;
	const lng = interaction.userLanguage;

	const container = new ContainerBuilder();

	// Title
	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent(
			`### ${i18n.t("commands:report.city.enchanter.title", { lng, pseudo })}`
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
			addCitySection(
				container,
				itemDisplay,
				`ENCHANT_ITEM_${i}`,
				i18n.t("commands:report.city.buttons.enchant", { lng })
			);
		}
	}

	// Back to city button
	container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
	container.addActionRowComponents(
		new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder()
				.setCustomId("BACK_TO_CITY")
				.setLabel(i18n.t("commands:report.city.enchanter.leave", { lng }))
				.setEmoji(CrowniclesIcons.city.exit)
				.setStyle(ButtonStyle.Secondary)
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
function createEnchanterMenuCollector(
	context: PacketContext,
	interaction: CrowniclesInteraction,
	packet: ReactionCollectorCreationPacket,
	data: ReactionCollectorCityData["enchanter"] & object,
	collectorTime: number
): (nestedMenus: CrowniclesNestedMenus, message: import("discord.js").Message) => CrowniclesNestedMenuCollector {
	const lng = interaction.userLanguage;

	return (nestedMenus, message): CrowniclesNestedMenuCollector => {
		const collector = message.createMessageComponentCollector({ time: collectorTime });

		collector.on("collect", async (buttonInteraction: MessageComponentInteraction) => {
			if (buttonInteraction.user.id !== interaction.user.id) {
				await sendInteractionNotForYou(buttonInteraction.user, buttonInteraction, lng);
				return;
			}

			const selectedValue = buttonInteraction.customId;

			if (selectedValue.startsWith("ENCHANT_ITEM_")) {
				await buttonInteraction.deferReply();
				const index = parseInt(selectedValue.replace("ENCHANT_ITEM_", ""), 10);
				if (index >= 0 && index < data.enchantableItems.length) {
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
			}
			else if (selectedValue === "BACK_TO_CITY") {
				await buttonInteraction.deferUpdate();
				await nestedMenus.changeToMainMenu();
			}
		});

		return collector;
	};
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
		addCitySection(
			container,
			`${CrowniclesIcons.collectors.accept} **${i18n.t("commands:report.city.homes.buyHome", { lng })}**`,
			"BUY_HOME",
			i18n.t("commands:report.city.buttons.confirm", { lng }),
			ButtonStyle.Success,
			CrowniclesIcons.collectors.accept
		);
	}
	else if (data.upgrade && data.upgrade.price <= data.currentMoney) {
		container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
		addCitySection(
			container,
			`${CrowniclesIcons.collectors.accept} **${i18n.t("commands:report.city.homes.upgradeHome", { lng })}**`,
			"UPGRADE_HOME",
			i18n.t("commands:report.city.buttons.confirm", { lng }),
			ButtonStyle.Success,
			CrowniclesIcons.collectors.accept
		);
	}
	else if (data.movePrice && data.movePrice <= data.currentMoney) {
		container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
		addCitySection(
			container,
			`${CrowniclesIcons.collectors.accept} **${i18n.t("commands:report.city.homes.moveHome", { lng })}**`,
			"MOVE_HOME",
			i18n.t("commands:report.city.buttons.confirm", { lng }),
			ButtonStyle.Success,
			CrowniclesIcons.collectors.accept
		);
	}
}

function getManageHomeMenu(context: PacketContext, interaction: CrowniclesInteraction, packet: ReactionCollectorCreationPacket, collectorTime: number, pseudo: string): CrowniclesNestedMenu {
	const data = (packet.data.data as ReactionCollectorCityData).home.manage!;
	const lng = interaction.userLanguage;

	const container = new ContainerBuilder();

	// Title
	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent(
			`### ${i18n.t("commands:report.city.homes.notaryTitle", { lng, pseudo })}`
		)
	);

	// Story
	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent(
			`${i18n.t("commands:report.city.homes.notaryIntroduction", { lng })}\n\n${buildNotaryDescription(data, lng)}`
		)
	);

	// Action button (buy/upgrade/move if affordable)
	addNotaryActionButton(container, data, lng);

	// Back to city button
	container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
	container.addActionRowComponents(
		new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder()
				.setCustomId("BACK_TO_CITY")
				.setLabel(i18n.t("commands:report.city.homes.leaveNotary", { lng }))
				.setEmoji(CrowniclesIcons.city.exit)
				.setStyle(ButtonStyle.Secondary)
		)
	);

	return {
		containers: [container],
		createCollector: createManageHomeMenuCollector(context, interaction, packet, collectorTime)
	};
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
	const lng = interaction.userLanguage;

	const homeActionRoutes: Record<string, string> = {
		BUY_HOME: ReactionCollectorCityBuyHomeReaction.name,
		UPGRADE_HOME: ReactionCollectorCityUpgradeHomeReaction.name,
		MOVE_HOME: ReactionCollectorCityMoveHomeReaction.name
	};

	return (nestedMenus, message): CrowniclesNestedMenuCollector => {
		const collector = message.createMessageComponentCollector({ time: collectorTime });

		collector.on("collect", async (buttonInteraction: MessageComponentInteraction) => {
			if (buttonInteraction.user.id !== interaction.user.id) {
				await sendInteractionNotForYou(buttonInteraction.user, buttonInteraction, lng);
				return;
			}

			const selectedValue = buttonInteraction.customId;

			if (homeActionRoutes[selectedValue]) {
				await buttonInteraction.deferReply();
				const reactionIndex = packet.reactions.findIndex(
					reaction => reaction.type === homeActionRoutes[selectedValue]
				);
				if (reactionIndex !== -1) {
					DiscordCollectorUtils.sendReaction(packet, context, context.keycloakId!, buttonInteraction, reactionIndex);
				}
			}
			else if (selectedValue === "BACK_TO_CITY") {
				await buttonInteraction.deferUpdate();
				await nestedMenus.changeToMainMenu();
			}
		});

		return collector;
	};
}

/**
 * Build the city sub-menus (inns, enchanter, home, manage home)
 */
function buildCitySubMenus(params: HomeMenuParams): Map<string, CrowniclesNestedMenu> {
	const {
		context, interaction, packet, collectorTime, pseudo
	} = params;
	const menus = new Map<string, CrowniclesNestedMenu>();
	const cityData = packet.data.data as ReactionCollectorCityData;

	// Add inn menus
	for (const inn of cityData.inns || []) {
		menus.set(`INN_${inn.innId}`, getInnMenu(context, interaction, packet, inn.innId, collectorTime, pseudo));
	}

	// Add enchanter menu
	if (cityData.enchanter) {
		menus.set("ENCHANTER_MENU", getEnchanterMenu(context, interaction, packet, collectorTime, pseudo));
	}

	// Add blacksmith menus
	if (cityData.blacksmith) {
		for (const [key, menu] of getBlacksmithMenus(params)) {
			menus.set(key, menu);
		}
	}

	// Add home menus
	if (cityData.home.owned) {
		menus.set(HomeMenuIds.HOME_MENU, getHomeMenu(params));

		for (const [key, menu] of getHomeSubMenus(params)) {
			menus.set(key, menu);
		}
	}

	// Add manage home menu
	if (cityData.home.manage) {
		menus.set(HomeMenuIds.MANAGE_HOME_MENU, getManageHomeMenu(context, interaction, packet, collectorTime, pseudo));
	}

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
