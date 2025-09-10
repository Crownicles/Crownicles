import {
	CrowniclesNestedMenu,
	CrowniclesNestedMenuCollector,
	CrowniclesNestedMenus
} from "../../../messages/CrowniclesNestedMenus";
import { CrowniclesEmbed } from "../../../messages/CrowniclesEmbed";
import i18n from "../../../translations/i18n";
import { DisplayUtils } from "../../../utils/DisplayUtils";
import {
	millisecondsToMinutes, minutesDisplay
} from "../../../../../Lib/src/utils/TimeUtils";
import { CrowniclesInteraction } from "../../../messages/CrowniclesInteraction";
import {
	makePacket, PacketContext
} from "../../../../../Lib/src/packets/CrowniclesPacket";
import {
	ReactionCollectorCityData,
	ReactionCollectorExitCityReaction,
	ReactionCollectorInnMealReaction
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

function getMainMenu(context: PacketContext, interaction: CrowniclesInteraction, packet: ReactionCollectorCreationPacket, collectorTime: number, pseudo: string): CrowniclesNestedMenu {
	const data = packet.data.data as ReactionCollectorCityData;
	const lng = interaction.userLanguage;

	const selectMenu = new StringSelectMenuBuilder()
		.setCustomId(ReactionCollectorExitCityReaction.name)
		.setPlaceholder(i18n.t("commands:report.city.placeholder", { lng }));

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
				timeInCity: data.timeInCity < 60000 ? i18n.t("commands:report.city.shortTime", { lng }) : minutesDisplay(millisecondsToMinutes(data.timeInCity), lng)
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

	// Meals
	for (const meal of data.inns?.find(i => i.innId === innId)?.meals || []) {
		selectMenu.setCustomId(`MEAL_${meal.mealId}`)
			.setPlaceholder(i18n.t("commands:report.city.placeholder", { lng }))
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

	// Exit inn reaction
	selectMenu.setCustomId("BACK_TO_CITY")
		.setPlaceholder(i18n.t("commands:report.city.placeholder", { lng }))
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
			.setDescription(i18n.t(`commands:report.city.inns.stories.${innId}`, {
				lng
			}) + "\n\n" + i18n.t("commands:report.city.inns.storiesEnergyAndHealth", {
				lng,
				currentEnergy: data.energy.current,
				maxEnergy: data.energy.max,
				currentHealth: data.health.current,
				maxHealth: data.health.max
			})),
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
					return;
				}

				if (selectedValue === "BACK_TO_CITY") {
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

		const nestedMenus = new CrowniclesNestedMenus(
			getMainMenu(context, interaction, packet, collectorTime, pseudo),
			new Map<string, CrowniclesNestedMenu>(
				(packet.data.data as ReactionCollectorCityData).inns?.map(inn => [
					`INN_${inn.innId}`,
					getInnMenu(context, interaction, packet, inn.innId, collectorTime, pseudo)
				]) || []
			),
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
