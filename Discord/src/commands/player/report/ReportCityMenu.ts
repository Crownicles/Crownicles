import {
	CrowniclesNestedMenu,
	CrowniclesNestedMenuCollector,
	CrowniclesNestedMenus
} from "../../../messages/CrowniclesNestedMenus";
import { CrowniclesEmbed } from "../../../messages/CrowniclesEmbed";
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
	ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuInteraction
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
	getHomeMenu, getHomeSubMenus
} from "./home";
import { HomeMenuParams } from "./home/HomeMenuTypes";
import { HomeMenuIds } from "./home/HomeMenuConstants";
import { getBlacksmithMenus } from "./blacksmith/BlacksmithMenu";

function getMainMenu(context: PacketContext, interaction: CrowniclesInteraction, packet: ReactionCollectorCreationPacket, collectorTime: number, pseudo: string): CrowniclesNestedMenu {
	const data = packet.data.data as ReactionCollectorCityData;
	const lng = interaction.userLanguage;

	const selectMenu = new StringSelectMenuBuilder()
		.setCustomId(ReactionCollectorExitCityReaction.name)
		.setPlaceholder(i18n.t("commands:report.city.placeholder", { lng }));

	// Owned home option
	if (data.home.owned) {
		selectMenu.addOptions({
			label: i18n.t("commands:report.city.homes.goToOwnedHome", { lng }),
			description: i18n.t("commands:report.city.homes.goToOwnedHomeDescription", { lng }),
			value: HomeMenuIds.HOME_MENU,
			emoji: CrowniclesIcons.city.home[data.home.owned.level]
		});
	}

	// Manage home option
	if (data.home.manage && (data.home.manage.newPrice || data.home.manage.upgrade || data.home.manage.movePrice)) {
		selectMenu.addOptions({
			label: i18n.t("commands:report.city.homes.manageHome", { lng }),
			description: data.home.manage.newPrice
				? i18n.t("commands:report.city.homes.manageHomeDescriptionNew", {
					lng
				})
				: data.home.manage.upgrade
					? i18n.t("commands:report.city.homes.manageHomeDescriptionUpgrade", {
						lng
					})
					: i18n.t("commands:report.city.homes.manageHomeDescriptionMove", {
						lng
					}),
			value: HomeMenuIds.MANAGE_HOME_MENU,
			emoji: CrowniclesIcons.city.manageHome
		});
	}

	// Enchanter option
	if (data.enchanter) {
		selectMenu.addOptions({
			label: i18n.t("commands:report.city.reactions.enchanter.label", { lng }),
			description: i18n.t("commands:report.city.reactions.enchanter.description", { lng }),
			value: "ENCHANTER_MENU",
			emoji: CrowniclesIcons.city.enchanter
		});
	}

	if (data.blacksmith) {
		selectMenu.addOptions({
			label: i18n.t("commands:report.city.blacksmith.menuLabel", { lng }),
			description: i18n.t("commands:report.city.blacksmith.menuDescription", { lng }),
			value: "BLACKSMITH_MENU",
			emoji: CrowniclesIcons.city.blacksmith.menu
		});
	}

	// Shops
	for (const shop of data.shops || []) {
		selectMenu.addOptions({
			label: i18n.t(`commands:report.city.shops.${shop.shopId}.label`, { lng }),
			description: i18n.t(`commands:report.city.shops.${shop.shopId}.description`, { lng }),
			value: `CITY_SHOP_${shop.shopId}`,
			emoji: CrowniclesIcons.city.shop
		});
	}

	// Inn option
	if (data.inns) {
		for (const inn of data.inns) {
			selectMenu.addOptions({
				label: i18n.t("commands:report.city.reactions.inn.label", {
					lng, innId: inn.innId
				}),
				description: i18n.t("commands:report.city.reactions.inn.description", { lng }),
				value: `MAIN_MENU_INN_${inn.innId}`,
				emoji: CrowniclesIcons.city.inn
			});
		}
	}

	// Other options
	for (const reaction of packet.reactions) {
		switch (reaction.type) {
			case ReactionCollectorExitCityReaction.name:
				selectMenu.addOptions({
					label: i18n.t("commands:report.city.reactions.exit.label", { lng }),
					description: i18n.t("commands:report.city.reactions.exit.description", { lng }),
					value: "MAIN_MENU_EXIT_CITY",
					emoji: CrowniclesIcons.city.exit
				});
				break;
			case ReactionCollectorRefuseReaction.name:
				selectMenu.addOptions({
					label: i18n.t("commands:report.city.reactions.stay.label", { lng }),
					description: i18n.t("commands:report.city.reactions.stay.description", { lng }),
					value: "MAIN_MENU_STAY_CITY",
					emoji: CrowniclesIcons.city.stay
				});
				break;
			default:
				break;
		}
	}

	return {
		embed: new CrowniclesEmbed().formatAuthor(i18n.t("commands:report.city.title", {
			lng,
			pseudo
		}), interaction.user)
			.setDescription(i18n.t("commands:report.city.description", {
				lng,
				mapLocationId: data.mapLocationId,
				mapTypeId: data.mapTypeId,
				enterCityTimestamp: millisecondsToSeconds(data.enterCityTimestamp)
			})),
		components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu)],
		createCollector: createMainMenuCollector(context, interaction, packet, collectorTime)
	};
}

/**
 * Handle a main menu selection value. Returns true if handled.
 */
async function handleMainMenuSelection(
	selectedValue: string,
	nestedMenus: CrowniclesNestedMenus,
	selectInteraction: StringSelectMenuInteraction,
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
			DiscordCollectorUtils.sendReaction(packet, context, context.keycloakId!, selectInteraction, reactionIndex);
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
			DiscordCollectorUtils.sendReaction(packet, context, context.keycloakId!, selectInteraction, reactionIndex);
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
): (nestedMenus: CrowniclesNestedMenus, message: import("discord.js").Message) => CrowniclesNestedMenuCollector {
	const lng = interaction.userLanguage;

	return (nestedMenus, message): CrowniclesNestedMenuCollector => {
		const selectMenuCollector = message.createMessageComponentCollector({
			time: collectorTime
		});

		selectMenuCollector.on("collect", async (selectInteraction: StringSelectMenuInteraction) => {
			if (selectInteraction.user.id !== interaction.user.id) {
				await sendInteractionNotForYou(selectInteraction.user, selectInteraction, lng);
				return;
			}

			await selectInteraction.deferUpdate();
			await handleMainMenuSelection(selectInteraction.values[0], nestedMenus, selectInteraction, context, packet);
		});

		return selectMenuCollector;
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

	const selectMenu = new StringSelectMenuBuilder();
	selectMenu.setCustomId("INN_MENU")
		.setPlaceholder(i18n.t("commands:report.city.placeholder", { lng }));

	// Meals
	for (const meal of data.inns?.find(i => i.innId === innId)?.meals || []) {
		selectMenu
			.addOptions({
				label: i18n.t(`commands:report.city.inns.meals.${meal.mealId}`, {
					lng
				}),
				description: i18n.t("commands:report.city.inns.mealDescription", {
					lng,
					price: meal.price,
					energy: meal.energy
				}),
				value: `MEAL_${meal.mealId}`,
				emoji: CrowniclesIcons.meals[meal.mealId]
			});
	}

	// Rooms
	for (const room of data.inns?.find(i => i.innId === innId)?.rooms || []) {
		selectMenu
			.addOptions({
				label: i18n.t(`commands:report.city.inns.rooms.${room.roomId}`, {
					lng
				}),
				description: i18n.t("commands:report.city.inns.roomDescription", {
					lng,
					price: room.price,
					health: room.health
				}),
				value: `ROOM_${room.roomId}`,
				emoji: CrowniclesIcons.rooms[room.roomId]
			});
	}

	// Exit inn reaction
	selectMenu
		.addOptions({
			label: i18n.t("commands:report.city.exitInn", { lng }),
			value: "BACK_TO_CITY",
			emoji: CrowniclesIcons.city.exit
		});

	return {
		embed: new CrowniclesEmbed()
			.formatAuthor(i18n.t("commands:report.city.inns.embedTitle", {
				lng,
				pseudo
			}), interaction.user)
			.setDescription(`${i18n.t(`commands:report.city.inns.stories.${innId}`, {
				lng
			})}\n\n${i18n.t("commands:report.city.inns.storiesEnergyAndHealth", {
				lng,
				currentEnergy: data.energy.current,
				maxEnergy: data.energy.max,
				currentHealth: data.health.current,
				maxHealth: data.health.max
			})}`),
		components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu)],
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
		const selectMenuCollector = message.createMessageComponentCollector({ time: collectorTime });

		selectMenuCollector.on("collect", async (selectInteraction: StringSelectMenuInteraction) => {
			if (selectInteraction.user.id !== interaction.user.id) {
				await sendInteractionNotForYou(selectInteraction.user, selectInteraction, lng);
				return;
			}

			const selectedValue = selectInteraction.values[0];

			if (selectedValue.startsWith("MEAL_")) {
				await selectInteraction.deferReply();
				const mealId = selectedValue.replace("MEAL_", "");
				const reactionIndex = packet.reactions.findIndex(
					reaction => reaction.type === ReactionCollectorInnMealReaction.name
						&& (reaction.data as ReactionCollectorInnMealReaction).meal.mealId === mealId
						&& (reaction.data as ReactionCollectorInnMealReaction).innId === innId
				);
				if (reactionIndex !== -1) {
					DiscordCollectorUtils.sendReaction(packet, context, context.keycloakId!, selectInteraction, reactionIndex);
				}
			}
			else if (selectedValue.startsWith("ROOM_")) {
				await selectInteraction.deferReply();
				const roomId = selectedValue.replace("ROOM_", "");
				const reactionIndex = packet.reactions.findIndex(
					reaction => reaction.type === ReactionCollectorInnRoomReaction.name
						&& (reaction.data as ReactionCollectorInnRoomReaction).room.roomId === roomId
						&& (reaction.data as ReactionCollectorInnRoomReaction).innId === innId
				);
				if (reactionIndex !== -1) {
					DiscordCollectorUtils.sendReaction(packet, context, context.keycloakId!, selectInteraction, reactionIndex);
				}
			}
			else if (selectedValue === "BACK_TO_CITY") {
				await selectInteraction.deferUpdate();
				await nestedMenus.changeToMainMenu();
			}
		});

		return selectMenuCollector;
	};
}

function getEnchanterMenu(context: PacketContext, interaction: CrowniclesInteraction, packet: ReactionCollectorCreationPacket, collectorTime: number, pseudo: string): CrowniclesNestedMenu {
	const data = (packet.data.data as ReactionCollectorCityData).enchanter!;
	const lng = interaction.userLanguage;

	// Description
	let desc;
	if (data.enchantableItems.length === 0) {
		desc = i18n.t("commands:report.city.enchanter.emptyInventoryStory", { lng });
	}
	else {
		desc = `${i18n.t("commands:report.city.enchanter.story", { lng })}\n\n`;
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
	}

	// Select menu
	const selectMenu = new StringSelectMenuBuilder();
	selectMenu.setCustomId("ENCHANTER_MENU")
		.setPlaceholder(i18n.t("commands:report.city.enchanter.placeholder", { lng }));

	// Available items
	for (let i = 0; i < data.enchantableItems.length; i++) {
		const item = data.enchantableItems[i];

		// Don't show max values because it doesn't work in select menu descriptions
		item.details.attack.maxValue = Infinity;
		item.details.defense.maxValue = Infinity;
		item.details.speed.maxValue = Infinity;

		const itemDisplay = DisplayUtils.getItemDisplayWithStats(item.details, lng);
		const parts = itemDisplay.split(" | ");
		const label = parts[0].split("**")[1];
		const rawDescription = parts.slice(1)
			.join(" | ")
			.trim();

		// Only add description if non-empty and truncate if too long (100 char limit)
		const option: {
			label: string;
			value: string;
			emoji: string;
			description?: string;
		} = {
			label,
			value: `ENCHANT_ITEM_${i}`,
			emoji: DisplayUtils.getItemIcon({
				id: item.details.id,
				category: item.details.itemCategory
			})
		};

		if (rawDescription) {
			option.description = rawDescription.length > 100
				? `${rawDescription.slice(0, 99)}…`
				: rawDescription;
		}

		selectMenu.addOptions(option);
	}

	// Go back option
	selectMenu
		.addOptions({
			label: i18n.t("commands:report.city.enchanter.leave", { lng }),
			value: "BACK_TO_CITY",
			emoji: CrowniclesIcons.city.exit
		});

	return {
		embed: new CrowniclesEmbed()
			.formatAuthor(i18n.t("commands:report.city.enchanter.title", {
				lng,
				pseudo
			}), interaction.user)
			.setDescription(desc),
		components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu)],
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
		const selectMenuCollector = message.createMessageComponentCollector({ time: collectorTime });

		selectMenuCollector.on("collect", async (selectInteraction: StringSelectMenuInteraction) => {
			if (selectInteraction.user.id !== interaction.user.id) {
				await sendInteractionNotForYou(selectInteraction.user, selectInteraction, lng);
				return;
			}

			const selectedValue = selectInteraction.values[0];

			if (selectedValue.startsWith("ENCHANT_ITEM_")) {
				await selectInteraction.deferReply();
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
						DiscordCollectorUtils.sendReaction(packet, context, context.keycloakId!, selectInteraction, reactionIndex);
					}
				}
			}
			else if (selectedValue === "BACK_TO_CITY") {
				await selectInteraction.deferUpdate();
				await nestedMenus.changeToMainMenu();
			}
		});

		return selectMenuCollector;
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
		hasChanged: (o, n): boolean => o.craftPotionMaximumRarity !== n.craftPotionMaximumRarity,
		isNew: (o): boolean => o.craftPotionMaximumRarity === ItemRarity.BASIC,
		newKey: "craftPotionStation",
		upgradeKey: "betterCraftPotionStation"
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

function getManageHomeMenu(context: PacketContext, interaction: CrowniclesInteraction, packet: ReactionCollectorCreationPacket, collectorTime: number, pseudo: string): CrowniclesNestedMenu {
	const data = (packet.data.data as ReactionCollectorCityData).home.manage!;
	const lng = interaction.userLanguage;

	const title = i18n.t("commands:report.city.homes.notaryTitle", {
		lng,
		pseudo
	});
	let description = `${i18n.t("commands:report.city.homes.notaryIntroduction", { lng })}\n\n`;

	if (data.newPrice) {
		if (data.newPrice > data.currentMoney) {
			description += i18n.t("commands:report.city.homes.notaryNewHomeNoMoney", {
				lng,
				cost: data.newPrice,
				missingMoney: data.newPrice - data.currentMoney
			});
		}
		else {
			description += i18n.t("commands:report.city.homes.notaryNewHomeEnoughMoney", {
				lng,
				cost: data.newPrice
			});
		}
	}
	else if (data.upgrade) {
		if (data.upgrade.price > data.currentMoney) {
			description += i18n.t("commands:report.city.homes.notaryUpgradeHomeNoMoney", {
				lng,
				cost: data.upgrade.price,
				missingMoney: data.upgrade.price - data.currentMoney
			});
		}
		else {
			const upgradeChanges = formatHomeUpgradeChanges(data.upgrade.oldFeatures, data.upgrade.newFeatures, lng);
			description += i18n.t("commands:report.city.homes.notaryUpgradeHomeEnoughMoney", {
				lng,
				cost: data.upgrade.price,
				upgradeChanges
			});
		}
	}
	else if (data.movePrice) {
		if (data.movePrice > data.currentMoney) {
			description += i18n.t("commands:report.city.homes.notaryMoveHomeNoMoney", {
				lng,
				cost: data.movePrice,
				missingMoney: data.movePrice - data.currentMoney
			});
		}
		else {
			description += i18n.t("commands:report.city.homes.notaryMoveHomeEnoughMoney", {
				lng,
				cost: data.movePrice
			});
		}
	}
	else {
		console.warn("Manage home menu opened without any available action");
	}

	const selectMenu = new StringSelectMenuBuilder()
		.setCustomId(HomeMenuIds.MANAGE_HOME_MENU)
		.setPlaceholder(i18n.t("commands:report.city.placeholder", { lng }));

	// Add action option based on what's available
	if (data.newPrice && data.newPrice <= data.currentMoney) {
		selectMenu.addOptions({
			label: i18n.t("commands:report.city.homes.buyHome", { lng }),
			value: "BUY_HOME",
			emoji: CrowniclesIcons.collectors.accept
		});
	}
	else if (data.upgrade && data.upgrade.price <= data.currentMoney) {
		selectMenu.addOptions({
			label: i18n.t("commands:report.city.homes.upgradeHome", { lng }),
			value: "UPGRADE_HOME",
			emoji: CrowniclesIcons.collectors.accept
		});
	}
	else if (data.movePrice && data.movePrice <= data.currentMoney) {
		selectMenu.addOptions({
			label: i18n.t("commands:report.city.homes.moveHome", { lng }),
			value: "MOVE_HOME",
			emoji: CrowniclesIcons.collectors.accept
		});
	}

	// Back option
	selectMenu.addOptions({
		label: selectMenu.options.length === 0 ? i18n.t("commands:report.city.homes.leaveNotary", { lng }) : i18n.t("commands:report.city.homes.refuseAndLeaveNotary", { lng }),
		value: "BACK_TO_CITY",
		emoji: selectMenu.options.length === 0 ? CrowniclesIcons.city.exit : CrowniclesIcons.collectors.refuse
	});

	return {
		embed: new CrowniclesEmbed()
			.formatAuthor(title, interaction.user)
			.setDescription(description),
		components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu)],
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
		const selectMenuCollector = message.createMessageComponentCollector({ time: collectorTime });

		selectMenuCollector.on("collect", async (selectInteraction: StringSelectMenuInteraction) => {
			if (selectInteraction.user.id !== interaction.user.id) {
				await sendInteractionNotForYou(selectInteraction.user, selectInteraction, lng);
				return;
			}

			const selectedValue = selectInteraction.values[0];

			if (homeActionRoutes[selectedValue]) {
				await selectInteraction.deferReply();
				const reactionIndex = packet.reactions.findIndex(
					reaction => reaction.type === homeActionRoutes[selectedValue]
				);
				if (reactionIndex !== -1) {
					DiscordCollectorUtils.sendReaction(packet, context, context.keycloakId!, selectInteraction, reactionIndex);
				}
			}
			else if (selectedValue === "BACK_TO_CITY") {
				await selectInteraction.deferUpdate();
				await nestedMenus.changeToMainMenu();
			}
		});

		return selectMenuCollector;
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
