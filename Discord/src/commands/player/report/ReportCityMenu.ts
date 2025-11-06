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
	ReactionCollectorCityData,
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

function getMainMenu(context: PacketContext, interaction: CrowniclesInteraction, packet: ReactionCollectorCreationPacket, collectorTime: number, pseudo: string): CrowniclesNestedMenu {
	const data = packet.data.data as ReactionCollectorCityData;
	const lng = interaction.userLanguage;

	const selectMenu = new StringSelectMenuBuilder()
		.setCustomId(ReactionCollectorExitCityReaction.name)
		.setPlaceholder(i18n.t("commands:report.city.placeholder", { lng }));

	// Enchanter option
	if (data.enchanter) {
		selectMenu.addOptions({
			label: i18n.t("commands:report.city.reactions.enchanter.label", { lng }),
			description: i18n.t("commands:report.city.reactions.enchanter.description", { lng }),
			value: "ENCHANTER_MENU",
			emoji: CrowniclesIcons.city.enchanter
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

				await selectInteraction.deferReply();
				const selectedValue = selectInteraction.values[0];

				if (selectedValue.startsWith("MEAL_")) {
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
		const description = parts.slice(1).join(" | ");
		selectMenu
			.addOptions({
				label,
				description,
				value: `ENCHANT_ITEM_${i}`,
				emoji: DisplayUtils.getItemIcon({
					id: item.details.id,
					category: item.details.itemCategory
				})
			});
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
