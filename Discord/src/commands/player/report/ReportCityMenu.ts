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
import { HomeFeatures } from "../../../../../Lib/src/types/HomeFeatures";
import { Language } from "../../../../../Lib/src/Language";
import { ItemRarity } from "../../../../../Lib/src/constants/ItemConstants";

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
			value: "HOME_MENU",
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
			value: "MANAGE_HOME_MENU",
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
		createCollector: (nestedMenus, message): CrowniclesNestedMenuCollector => {
			const selectMenuCollector = message.createMessageComponentCollector({
				time: collectorTime
			});

			selectMenuCollector.on("collect", async (selectInteraction: StringSelectMenuInteraction) => {
				if (selectInteraction.user.id !== interaction.user.id) {
					await sendInteractionNotForYou(selectInteraction.user, selectInteraction, lng);
					return;
				}

				await selectInteraction.deferUpdate();
				const selectedValue = selectInteraction.values[0];

				if (selectedValue === "ENCHANTER_MENU") {
					await nestedMenus.changeMenu("ENCHANTER_MENU");
					return;
				}

				if (selectedValue === "HOME_MENU") {
					await nestedMenus.changeMenu("HOME_MENU");
					return;
				}

				if (selectedValue === "MANAGE_HOME_MENU") {
					await nestedMenus.changeMenu("MANAGE_HOME_MENU");
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

				if (selectedValue === "MAIN_MENU_EXIT_CITY") {
					const reactionIndex = packet.reactions.findIndex(reaction => reaction.type === ReactionCollectorExitCityReaction.name);
					if (reactionIndex !== -1) {
						DiscordCollectorUtils.sendReaction(packet, context, context.keycloakId!, selectInteraction, reactionIndex);
					}
					return;
				}

				if (selectedValue === "MAIN_MENU_STAY_CITY") {
					const reactionIndex = packet.reactions.findIndex(reaction => reaction.type === ReactionCollectorRefuseReaction.name);
					if (reactionIndex !== -1) {
						DiscordCollectorUtils.sendReaction(packet, context, context.keycloakId!, selectInteraction, reactionIndex);
					}
				}
			});

			return selectMenuCollector;
		}
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
		createCollector: (nestedMenus, message): CrowniclesNestedMenuCollector => {
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
		}
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
		createCollector: (nestedMenus, message): CrowniclesNestedMenuCollector => {
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
		}
	};
}

const formatHomeUpgradeChanges = (oldFeatures: HomeFeatures, newFeatures: HomeFeatures, lng: Language): string => {
	const changes: string[] = [];

	// Chest
	if (oldFeatures.chestSlots !== newFeatures.chestSlots) {
		if (oldFeatures.chestSlots === 0) {
			changes.push(i18n.t("commands:report.city.homes.upgradeChanges.chest", { lng }));
		}
		else {
			changes.push(i18n.t("commands:report.city.homes.upgradeChanges.biggerChest", { lng }));
		}
	}

	// Item upgrade rarity
	if (oldFeatures.upgradeItemMaximumRarity !== newFeatures.upgradeItemMaximumRarity) {
		if (oldFeatures.upgradeItemMaximumRarity === ItemRarity.BASIC) {
			changes.push(i18n.t("commands:report.city.homes.upgradeChanges.upgradeItemStation", { lng }));
		}
		else {
			changes.push(i18n.t("commands:report.city.homes.upgradeChanges.betterUpgradeItemStation", { lng }));
		}
	}

	// Potion craft rarity
	if (oldFeatures.craftPotionMaximumRarity !== newFeatures.craftPotionMaximumRarity) {
		if (oldFeatures.craftPotionMaximumRarity === ItemRarity.BASIC) {
			changes.push(i18n.t("commands:report.city.homes.upgradeChanges.craftPotionStation", { lng }));
		}
		else {
			changes.push(i18n.t("commands:report.city.homes.upgradeChanges.betterCraftPotionStation", { lng }));
		}
	}

	// Bed
	if (oldFeatures.bedHealthRegeneration !== newFeatures.bedHealthRegeneration) {
		changes.push(i18n.t("commands:report.city.homes.upgradeChanges.betterBed", { lng }));
	}

	// Garden plots
	if (oldFeatures.gardenPlots !== newFeatures.gardenPlots) {
		if (oldFeatures.gardenPlots === 0) {
			changes.push(i18n.t("commands:report.city.homes.upgradeChanges.garden", { lng }));
		}
		else {
			changes.push(i18n.t("commands:report.city.homes.upgradeChanges.biggerGarden", { lng }));
		}
	}

	// Garden earth quality
	if (oldFeatures.gardenEarthQuality !== newFeatures.gardenEarthQuality) {
		changes.push(i18n.t("commands:report.city.homes.upgradeChanges.betterGardenEarth", { lng }));
	}

	for (let i = 0; i < changes.length; i++) {
		changes[i] = `- ${changes[i]}`;
	}

	return changes.join("\n");
};

function getManageHomeMenu(context: PacketContext, interaction: CrowniclesInteraction, packet: ReactionCollectorCreationPacket, collectorTime: number, pseudo: string): CrowniclesNestedMenu {
	const data = (packet.data.data as ReactionCollectorCityData).home.manage!;
	const lng = interaction.userLanguage;

	const title = i18n.t("commands:report.city.homes.notaryTitle", {
		lng,
		pseudo
	});
	let description = i18n.t("commands:report.city.homes.notaryIntroduction", { lng }) + "\n\n";

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
		.setCustomId("MANAGE_HOME_MENU")
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
		createCollector: (nestedMenus, message): CrowniclesNestedMenuCollector => {
			const selectMenuCollector = message.createMessageComponentCollector({ time: collectorTime });

			selectMenuCollector.on("collect", async (selectInteraction: StringSelectMenuInteraction) => {
				if (selectInteraction.user.id !== interaction.user.id) {
					await sendInteractionNotForYou(selectInteraction.user, selectInteraction, lng);
					return;
				}

				const selectedValue = selectInteraction.values[0];

				if (selectedValue === "BUY_HOME") {
					await selectInteraction.deferReply();
					const reactionIndex = packet.reactions.findIndex(
						reaction => reaction.type === ReactionCollectorCityBuyHomeReaction.name
					);
					if (reactionIndex !== -1) {
						DiscordCollectorUtils.sendReaction(packet, context, context.keycloakId!, selectInteraction, reactionIndex);
					}
				}
				else if (selectedValue === "UPGRADE_HOME") {
					await selectInteraction.deferReply();
					const reactionIndex = packet.reactions.findIndex(
						reaction => reaction.type === ReactionCollectorCityUpgradeHomeReaction.name
					);
					if (reactionIndex !== -1) {
						DiscordCollectorUtils.sendReaction(packet, context, context.keycloakId!, selectInteraction, reactionIndex);
					}
				}
				else if (selectedValue === "MOVE_HOME") {
					await selectInteraction.deferReply();
					const reactionIndex = packet.reactions.findIndex(
						reaction => reaction.type === ReactionCollectorCityMoveHomeReaction.name
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
		}
	};
}

function getHomeMenu(): CrowniclesNestedMenu {
	throw new Error("Not implemented yet"); // todo
}

export class ReportCityMenu {
	public static async handleCityCollector(context: PacketContext, packet: ReactionCollectorCreationPacket): Promise<ReactionCollectorReturnTypeOrNull> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);
		if (!interaction) {
			throw new Error("Interaction not found");
		}
		const lng = interaction.userLanguage;
		const collectorTime = packet.endTime - Date.now();
		const pseudo = await DisplayUtils.getEscapedUsername(context.keycloakId!, lng);

		const menus: Map<string, CrowniclesNestedMenu> = new Map<string, CrowniclesNestedMenu>();
		for (const inn of (packet.data.data as ReactionCollectorCityData).inns || []) {
			menus.set(`INN_${inn.innId}`, getInnMenu(context, interaction, packet, inn.innId, collectorTime, pseudo));
		}
		if ((packet.data.data as ReactionCollectorCityData).enchanter) {
			menus.set("ENCHANTER_MENU", getEnchanterMenu(context, interaction, packet, collectorTime, pseudo));
		}

		/*
		 *if ((packet.data.data as ReactionCollectorCityData).home.owned) {
		 *menus.set("HOME_MENU", getHomeMenu());
		 *}
		 */
		if ((packet.data.data as ReactionCollectorCityData).home.manage) {
			menus.set("MANAGE_HOME_MENU", getManageHomeMenu(context, interaction, packet, collectorTime, pseudo));
		}

		const nestedMenus = new CrowniclesNestedMenus(
			getMainMenu(context, interaction, packet, collectorTime, pseudo),
			menus,
			() => {
				PacketUtils.sendPacketToBackend(context, makePacket(ReactionCollectorResetTimerPacketReq, { reactionCollectorId: packet.id }));
			}
		);
		const msg = await nestedMenus.send(interaction);

		const dummyCollector = msg.createReactionCollector();
		dummyCollector.on("end", async () => {
			await nestedMenus.stopCurrentCollector();
		});

		return [dummyCollector];
	}
}
