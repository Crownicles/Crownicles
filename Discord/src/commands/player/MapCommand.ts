import { CrowniclesInteraction } from "../../messages/CrowniclesInteraction";
import {
	CommandMapDisplayRes, CommandMapPacketReq
} from "../../../../Lib/src/packets/commands/CommandMapPacket";
import {
	makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { ICommand } from "../ICommand";
import { SlashCommandBuilderGenerator } from "../SlashCommandBuilderGenerator";
import { DiscordCache } from "../../bot/DiscordCache";
import { CrowniclesEmbed } from "../../messages/CrowniclesEmbed";
import i18n from "../../translations/i18n";
import { MapConstants } from "../../../../Lib/src/constants/MapConstants";
import { CrowniclesIcons } from "../../../../Lib/src/CrowniclesIcons";
import { EmoteUtils } from "../../utils/EmoteUtils";
import { escapeUsername } from "../../utils/StringUtils";

function getPacket(interaction: CrowniclesInteraction): CommandMapPacketReq {
	return makePacket(CommandMapPacketReq, { language: interaction.userLanguage });
}

/**
 * Sets the map image in the embed
 * @param embed
 * @param mapLink
 */
async function setEmbedMap(embed: CrowniclesEmbed, mapLink: {
	name: string;
	fallback?: string;
	forced: boolean;
}): Promise<void> {
	if (mapLink.forced && !mapLink.fallback) {
		embed.setImage(MapConstants.FORCED_MAPS_URL.replace("{name}", mapLink.name));
	}
	else {
		await fetch(mapLink.forced
			? MapConstants.FORCED_MAPS_URL.replace("{name}", mapLink.name)
			: MapConstants.MAP_URL_WITH_CURSOR.replace("{mapLink}", mapLink.name))
			.then(res => {
				if (res.status !== 200 && mapLink.fallback) {
					embed.setImage(mapLink.forced
						? MapConstants.FORCED_MAPS_URL.replace("{name}", mapLink.fallback)
						: MapConstants.MAP_URL_WITH_CURSOR.replace("{mapLink}", mapLink.fallback));
				}
				else {
					embed.setImage(mapLink.forced
						? MapConstants.FORCED_MAPS_URL.replace("{name}", mapLink.name)
						: MapConstants.MAP_URL_WITH_CURSOR.replace("{mapLink}", mapLink.name));
				}
			})
			.catch(() => {
				if (mapLink.fallback) {
					embed.setImage(mapLink.forced
						? MapConstants.FORCED_MAPS_URL.replace("{name}", mapLink.fallback)
						: MapConstants.MAP_URL_WITH_CURSOR.replace("{mapLink}", mapLink.fallback));
				}
			});
	}
}

/**
 * Handles the response of the map command
 * @param packet
 * @param context
 */
export async function handleCommandMapDisplayRes(packet: CommandMapDisplayRes, context: PacketContext): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction);

	if (!interaction) {
		return;
	}
	const lng = interaction.userLanguage;
	const embed = new CrowniclesEmbed().formatAuthor(i18n.t("commands:map.title", {
		lng,
		pseudo: escapeUsername(interaction.user.displayName)
	}), interaction.user);
	await setEmbedMap(embed, packet.mapLink);
	const mapName = i18n.t(`models:map_locations.${packet.mapId}.name`, {
		lng
	});
	const mapParticle = i18n.t(`models:map_locations.${packet.mapId}.particle`, { lng });
	const mapDescription = i18n.t(`models:map_locations.${packet.mapId}.description`, {
		lng
	});
	embed.setDescription(i18n.t(packet.hasArrived
		? "commands:map.description.arrived"
		: "commands:map.description.ongoing", {
		lng,
		destination: mapName,
		particle: mapParticle,
		emote: EmoteUtils.translateEmojiToDiscord(CrowniclesIcons.mapTypes[packet.mapType]),
		description: mapDescription
	}));
	await interaction.reply({ embeds: [embed] });
}

export const commandInfo: ICommand = {
	slashCommandBuilder: SlashCommandBuilderGenerator.generateBaseCommand("map"),
	getPacket,
	mainGuildCommand: false
};
