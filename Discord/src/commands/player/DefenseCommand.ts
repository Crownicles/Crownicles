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
	DiscordCollectorUtils, SEND_POLITICS
} from "../../utils/DiscordCollectorUtils";
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

/**
 * Get the translated name of a defense personality, a missing one being a random personality at each fight
 * @param personality
 * @param lng
 */
function getPersonalityName(personality: AiPersonality | undefined, lng: Language): string {
	return i18n.t(`commands:defense.personalities.${personality ?? RANDOM_PERSONALITY_KEY}.name`, { lng });
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
	const currentPersonality = packet.data.data.currentPersonality;
	const choices = packet.reactions
		.filter(reaction => reaction.type === ReactionCollectorDefensePersonalityReaction.name)
		.map(reaction => (reaction.data as ReactionCollectorDefensePersonalityReaction).personality);

	const embed = new CrowniclesEmbed()
		.formatAuthor(i18n.t("commands:defense.title", {
			lng,
			pseudo: escapeUsername(interaction.user.displayName)
		}), interaction.user)
		.setDescription(i18n.t("commands:defense.description", { lng }));

	return await DiscordCollectorUtils.createChoiceListCollector(interaction, {
		packet,
		context
	}, {
		embed,
		items: choices.map(personality => i18n.t(personality === currentPersonality ? "commands:defense.currentChoice" : "commands:defense.choice", {
			lng,
			name: getPersonalityName(personality, lng),
			description: i18n.t(`commands:defense.personalities.${personality ?? RANDOM_PERSONALITY_KEY}.description`, { lng })
		}))
	}, {
		refuse: {
			can: true,
			reactionIndex: packet.reactions.findIndex(reaction => reaction.type === ReactionCollectorRefuseReaction.name)
		},
		sendManners: SEND_POLITICS.EDIT_REPLY_OR_FOLLOWUP
	});
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
