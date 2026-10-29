import {
	CommandDefenseChangeSuccessPacketRes,
	CommandDefensePacketReq
} from "../../../../Lib/src/packets/commands/CommandDefensePacket";
import {
	makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { ICommand } from "../ICommand";
import { SlashCommandBuilderGenerator } from "../SlashCommandBuilderGenerator";
import { DiscordCache } from "../../bot/DiscordCache";
import i18n from "../../translations/i18n";
import { CrowniclesEmbed } from "../../messages/CrowniclesEmbed";
import { CrowniclesInteraction } from "../../messages/CrowniclesInteraction";
import { ReactionCollectorRefuseReaction } from "../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import {
	ReactionCollectorDefensePersonalityPacket,
	ReactionCollectorDefensePersonalityReaction
} from "../../../../Lib/src/packets/interaction/ReactionCollectorDefensePersonality";
import { ReactionCollectorReturnTypeOrNull } from "../../packetHandlers/handlers/ReactionCollectorHandlers";
import {
	DiscordCollectorUtils, disableRows
} from "../../utils/DiscordCollectorUtils";
import {
	ActionRowBuilder, Message, parseEmoji, StringSelectMenuBuilder, StringSelectMenuInteraction, StringSelectMenuOptionBuilder
} from "discord.js";
import { CrowniclesIcons } from "../../../../Lib/src/CrowniclesIcons";
import { sendInteractionNotForYou } from "../../utils/ErrorUtils";
import { escapeUsername } from "../../utils/StringUtils";
import { AiPersonality } from "../../../../Lib/src/constants/AiPersonalityConstants";
import { Language } from "../../../../Lib/src/Language";

// Translation key of the choice letting a different personality be picked at random at each fight
const RANDOM_PERSONALITY_KEY = "random";

/**
 * Get the packet
 */
async function getPacket(interaction: CrowniclesInteraction): Promise<CommandDefensePacketReq> {
	await interaction.deferReply();
	return makePacket(CommandDefensePacketReq, {});
}

// Value of the menu option that keeps the current defense personality
const CANCEL_VALUE = "cancel";

/**
 * Translation key of a defense personality, a missing one being a random personality at each fight
 * @param personality
 */
function getPersonalityKey(personality: AiPersonality | undefined): string {
	return personality ?? RANDOM_PERSONALITY_KEY;
}

/**
 * Get the translated name of a defense personality, a missing one being a random personality at each fight
 * @param personality
 * @param lng
 */
function getPersonalityName(personality: AiPersonality | undefined, lng: Language): string {
	return i18n.t(`commands:defense.personalities.${getPersonalityKey(personality)}.name`, { lng });
}

/**
 * Embed presenting each defense personality of the class with its description, the current one being marked
 * @param interaction
 * @param packet
 * @param personalities
 */
function buildDefensePersonalitiesEmbed(
	interaction: CrowniclesInteraction,
	packet: ReactionCollectorDefensePersonalityPacket,
	personalities: (AiPersonality | undefined)[]
): CrowniclesEmbed {
	const lng = interaction.userLanguage;
	const currentPersonality = packet.data.data.currentPersonality;
	return new CrowniclesEmbed()
		.formatAuthor(i18n.t("commands:defense.title", {
			lng,
			pseudo: escapeUsername(interaction.user.displayName)
		}), interaction.user)
		.setDescription(i18n.t("commands:defense.intro", {
			lng,
			className: i18n.t(`models:classes.${packet.data.data.classId}`, { lng })
		}))
		.addFields(personalities.map(personality => ({
			name: i18n.t(personality === currentPersonality ? "commands:defense.currentChoiceTitle" : "commands:defense.choiceTitle", {
				lng,
				personality: getPersonalityKey(personality),
				name: getPersonalityName(personality, lng)
			}),
			value: i18n.t(`commands:defense.personalities.${getPersonalityKey(personality)}.description`, { lng })
		})));
}

/**
 * Menu listing the defense personalities, the current one being preselected, and a choice to keep it
 * @param lng
 * @param personalities
 * @param currentPersonality
 */
function buildDefensePersonalitiesMenu(lng: Language, personalities: (AiPersonality | undefined)[], currentPersonality: AiPersonality | undefined): StringSelectMenuBuilder {
	return new StringSelectMenuBuilder()
		.setCustomId("defensePersonalityMenu")
		.setPlaceholder(i18n.t("commands:defense.chooseStyle", { lng }))
		.addOptions(
			...personalities.map((personality, index) => new StringSelectMenuOptionBuilder()
				.setLabel(getPersonalityName(personality, lng))
				.setValue(index.toString())
				.setEmoji(parseEmoji(CrowniclesIcons.defensePersonalities[getPersonalityKey(personality)])!)
				.setDefault(personality === currentPersonality)),
			new StringSelectMenuOptionBuilder()
				.setLabel(i18n.t("commands:defense.cancel", { lng }))
				.setValue(CANCEL_VALUE)
				.setEmoji(parseEmoji(CrowniclesIcons.collectors.refuse)!)
		);
}

/**
 * Display the defense personalities of the class of the player, and let them pick one
 * @param context
 * @param packet
 */
export async function createDefensePersonalityCollector(context: PacketContext, packet: ReactionCollectorDefensePersonalityPacket): Promise<ReactionCollectorReturnTypeOrNull> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction);
	if (!interaction) {
		return null;
	}
	const lng = interaction.userLanguage;
	const choices = packet.reactions
		.map((reaction, reactionIndex) => ({
			reactionIndex,
			personality: (reaction.data as ReactionCollectorDefensePersonalityReaction).personality,
			isPersonality: reaction.type === ReactionCollectorDefensePersonalityReaction.name
		}))
		.filter(choice => choice.isPersonality);
	const personalities = choices.map(choice => choice.personality);

	const embed = buildDefensePersonalitiesEmbed(interaction, packet, personalities);
	const row = new ActionRowBuilder<StringSelectMenuBuilder>()
		.addComponents(buildDefensePersonalitiesMenu(lng, personalities, packet.data.data.currentPersonality));
	const msg = await interaction.editReply({
		embeds: [embed],
		components: [row]
	}) as Message;

	const menuCollector = msg.createMessageComponentCollector({
		time: DiscordCollectorUtils.getRemainingCollectorTime(packet)
	});
	menuCollector.on("collect", async (menuInteraction: StringSelectMenuInteraction) => {
		if (menuInteraction.user.id !== context.discord?.user) {
			await sendInteractionNotForYou(menuInteraction.user, menuInteraction, lng);
			return;
		}
		await menuInteraction.deferReply();
		menuCollector.stop();
		const selected = menuInteraction.values[0];
		DiscordCollectorUtils.sendReaction(
			packet,
			context,
			context.keycloakId!,
			menuInteraction,
			selected === CANCEL_VALUE
				? packet.reactions.findIndex(reaction => reaction.type === ReactionCollectorRefuseReaction.name)
				: choices[parseInt(selected, 10)].reactionIndex
		);
	});
	menuCollector.on("end", async () => {
		disableRows([row]);
		await msg.edit({ components: [row] });
	});

	return [menuCollector];
}

/**
 * Confirm the new defense personality of the player
 * @param context
 * @param packet
 */
export async function handleCommandDefenseChangeSuccessPacket(context: PacketContext, packet: CommandDefenseChangeSuccessPacketRes): Promise<void> {
	const interaction = DiscordCache.getButtonInteraction(context.discord!.buttonInteraction!);
	if (!interaction) {
		return;
	}
	const lng = context.discord!.language;
	await interaction.editReply({
		embeds: [
			new CrowniclesEmbed()
				.formatAuthor(i18n.t("commands:defense.successTitle", {
					lng,
					pseudo: escapeUsername(interaction.user.displayName)
				}), interaction.user)
				.setDescription(i18n.t(packet.personality ? "commands:defense.success" : "commands:defense.successRandom", {
					lng,
					personality: getPersonalityKey(packet.personality),
					name: getPersonalityName(packet.personality, lng)
				}))
		]
	});
}

export const commandInfo: ICommand = {
	slashCommandBuilder: SlashCommandBuilderGenerator.generateBaseCommand("defense"),
	getPacket,
	mainGuildCommand: false
};
