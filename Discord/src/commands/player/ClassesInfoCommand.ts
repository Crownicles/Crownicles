import {
	CommandClassesInfoPacketReq,
	CommandClassesInfoPacketRes
} from "../../../../Lib/src/packets/commands/CommandClassesInfoPacket";
import {
	makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { DiscordCache } from "../../bot/DiscordCache";
import { CrowniclesEmbed } from "../../messages/CrowniclesEmbed";
import i18n from "../../translations/i18n";
import { ICommand } from "../ICommand";
import { SlashCommandBuilderGenerator } from "../SlashCommandBuilderGenerator";
import { Constants } from "../../../../Lib/src/constants/Constants";
import { ClassInfoConstants } from "../../../../Lib/src/constants/ClassInfoConstants";
import { Language } from "../../../../Lib/src/Language";
import {
	ActionRowBuilder,
	EmbedField,
	StringSelectMenuBuilder,
	StringSelectMenuInteraction,
	StringSelectMenuOptionBuilder
} from "discord.js";
import { sendInteractionNotForYou } from "../../utils/ErrorUtils";
import { CrowniclesIcons } from "../../../../Lib/src/CrowniclesIcons";
import { ClassStats } from "../../../../Lib/src/types/ClassStats";
import { ClassKind } from "../../../../Lib/src/types/ClassKind";
import { DisplayUtils } from "../../utils/DisplayUtils";

/**
 * Get the packet
 */
function getPacket(): CommandClassesInfoPacketReq {
	return makePacket(CommandClassesInfoPacketReq, {});
}

/**
 * Get the list of classes
 * @param lng
 * @param classList
 */
function getListEmbed(lng: Language, classList: {
	id: number;
	stats: ClassStats;
	attacks: {
		id: string;
		cost: number;
	}[];
}[]): CrowniclesEmbed {
	const embed = new CrowniclesEmbed().setTitle(i18n.t("commands:classesInfo.title.list", { lng }));

	const classesFields: EmbedField[] = [];
	for (const foundClass of classList) {
		classesFields.push({
			name: DisplayUtils.getClassDisplay(foundClass.id, lng),
			value: i18n.t("commands:classesInfo.displays.class", {
				lng,
				health: foundClass.stats.health,
				attack: foundClass.stats.attack,
				defense: foundClass.stats.defense,
				speed: foundClass.stats.speed,
				baseBreath: foundClass.stats.baseBreath,
				maxBreath: foundClass.stats.maxBreath,
				breathRegen: foundClass.stats.breathRegen,
				fightPoint: foundClass.stats.fightPoint
			}),
			inline: false
		});
	}

	embed
		.setDescription(i18n.t("commands:classesInfo.description.list", {
			lng
		}))
		.addFields(classesFields);

	return embed;
}

/**
 * Get the details of a class
 * @param lng
 * @param classDetails
 */
function getDetailsEmbed(lng: Language, classDetails: {
	id: number;
	name: string;
	kind: ClassKind;
	description: string;
	attacks: {
		id: string;
		name: string;
		description: string;
		cost: number;
	}[];
}): CrowniclesEmbed {
	const embed = new CrowniclesEmbed().setTitle(DisplayUtils.getClassDisplay(classDetails.id, lng));

	const attackFields: EmbedField[] = [];
	for (const attack of classDetails.attacks) {
		attackFields.push({
			name: i18n.t("commands:classesInfo.title.attack", {
				lng,
				emote: CrowniclesIcons.fightActions[attack.id],
				name: attack.name,
				cost: attack.cost
			}),
			value: attack.description,
			inline: false
		});
	}

	embed
		.setDescription(i18n.t("commands:classesInfo.displays.details", {
			lng,
			classDetails: classDetails.description
		}))
		.setFields(attackFields);
	return embed;
}

/**
 * Handle the response packet
 * @param packet
 * @param context
 */
export async function handleCommandClassesInfoPacketRes(packet: CommandClassesInfoPacketRes, context: PacketContext): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction);

	if (!interaction) {
		return;
	}
	const lng = interaction.userLanguage;
	const classListEmbed = getListEmbed(lng, packet.data!.classesStats);
	const classesMenuOptions = packet.data!.classesStats.map(classStats => new StringSelectMenuOptionBuilder()
		.setLabel(`${i18n.t(`models:classes.${classStats.id}`, { lng })}`)
		.setEmoji(CrowniclesIcons.classes[classStats.id])
		.setValue(classStats.id.toString()));
	const classSelectionMenuOption = new StringSelectMenuOptionBuilder()
		.setLabel(i18n.t("commands:classesInfo.mainOption.name", { lng }))
		.setEmoji(CrowniclesIcons.commands.classesInfo)
		.setValue(ClassInfoConstants.MENU_IDS.LIST_OPTION);
	classesMenuOptions.unshift(classSelectionMenuOption);
	const classSelectionMenu = new StringSelectMenuBuilder()
		.setCustomId(ClassInfoConstants.MENU_IDS.CLASS_SELECTION)
		.setPlaceholder(i18n.t("commands:classesInfo.mainOption.placeholder", { lng }))
		.addOptions(classesMenuOptions);
	const row = new ActionRowBuilder<StringSelectMenuBuilder>()
		.addComponents(classSelectionMenu);
	const reply = await interaction.reply({
		embeds: [classListEmbed],
		components: [row],
		withResponse: true
	});
	if (!reply?.resource?.message) {
		return;
	}
	const msg = reply.resource.message;
	const collector = msg.createMessageComponentCollector({
		filter: menuInteraction => menuInteraction.customId === ClassInfoConstants.MENU_IDS.CLASS_SELECTION,
		time: Constants.MESSAGES.COLLECTOR_TIME
	});
	collector.on("collect", async (menuInteraction: StringSelectMenuInteraction) => {
		if (menuInteraction.user.id !== interaction.user.id) {
			await sendInteractionNotForYou(menuInteraction.user, menuInteraction, lng);
			return;
		}

		if (menuInteraction.values[0] === ClassInfoConstants.MENU_IDS.LIST_OPTION) {
			await menuInteraction.update({
				embeds: [classListEmbed],
				components: [row]
			});
			return;
		}
		const chosenClass = packet.data!.classesStats.find(classStats => classStats.id === parseInt(menuInteraction.values[0], 10));
		const attackList = [];

		for (const attack of chosenClass!.attacks) {
			attackList.push({
				id: attack.id,
				name: i18n.t(`models:fight_actions.${attack.id}.name_one`, { lng }),
				description: i18n.t(`models:fight_actions.${attack.id}.description`, { lng }),
				cost: attack.cost
			});
		}

		const classDetailsEmbed = getDetailsEmbed(lng, {
			id: parseInt(menuInteraction.values[0]),
			name: i18n.t(`models:classes.${parseInt(menuInteraction.values[0], 10)}`, { lng }),
			description: i18n.t(`models:class_descriptions.${parseInt(menuInteraction.values[0], 10)}`, { lng }),
			kind: chosenClass!.stats.classKind,
			attacks: attackList
		});

		await menuInteraction.update({
			embeds: [classDetailsEmbed],
			components: [row]
		});
	});

	collector.on("end", async () => {
		row.components.forEach(component => {
			component.setDisabled(true);
		});

		await msg.edit({ components: [row] });
	});
}

export const commandInfo: ICommand = {
	slashCommandBuilder: SlashCommandBuilderGenerator.generateBaseCommand("classesInfo"),
	getPacket,
	mainGuildCommand: false
};
