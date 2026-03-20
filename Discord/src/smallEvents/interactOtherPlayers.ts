import { PacketContext } from "../../../Lib/src/packets/CrowniclesPacket";
import { DiscordCache } from "../bot/DiscordCache";
import i18n from "../translations/i18n";
import { CrowniclesSmallEventEmbed } from "../messages/CrowniclesSmallEventEmbed";
import { StringUtils } from "../utils/StringUtils";
import { DiscordCollectorUtils } from "../utils/DiscordCollectorUtils";
import { ReactionCollectorInteractOtherPlayersPacket } from "../../../Lib/src/packets/interaction/ReactionCollectorInteractOtherPlayers";
import { Language } from "../../../Lib/src/Language";
import { CrowniclesIcons } from "../../../Lib/src/CrowniclesIcons";
import { ReactionCollectorReturnTypeOrNull } from "../packetHandlers/handlers/ReactionCollectorHandlers";
import { CrowniclesInteraction } from "../messages/CrowniclesInteraction";
import {
	InteractOtherPlayerInteraction,
	SmallEventInteractOtherPlayersPacket
} from "../../../Lib/src/packets/smallEvents/SmallEventInteractOtherPlayers";
import { DisplayUtils } from "../utils/DisplayUtils";
import { resolveKeycloakPlayerName } from "../utils/KeycloakPlayerUtils";

export async function interactOtherPlayerGetPlayerDisplay(keycloakId: string, rank: number | undefined, lng: Language): Promise<string> {
	const pseudo = await resolveKeycloakPlayerName(keycloakId, lng);
	return i18n.t(`smallEvents:interactOtherPlayers.playerDisplay${rank ? "Ranked" : "Unranked"}`, {
		lng,
		pseudo,
		rank
	});
}

export async function interactOtherPlayersCollector(context: PacketContext, packet: ReactionCollectorInteractOtherPlayersPacket): Promise<ReactionCollectorReturnTypeOrNull> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction)!;
	const lng = interaction.userLanguage;
	const data = packet.data.data;
	const playerDisplay = await interactOtherPlayerGetPlayerDisplay(data.keycloakId, data.rank, lng);

	const embed = new CrowniclesSmallEventEmbed(
		"interactOtherPlayers",
		StringUtils.getRandomTranslation(
			"smallEvents:interactOtherPlayers.poor",
			lng,
			{ playerDisplay }
		),
		interaction.user,
		lng
	);

	return await DiscordCollectorUtils.createAcceptRefuseCollector(
		interaction,
		embed,
		packet,
		context,
		{
			emojis: {
				accept: CrowniclesIcons.collectors.interactPoorCoin,
				refuse: CrowniclesIcons.collectors.refuse
			}
		}
	);
}

/**
 * Handles the case where no player is found for the interaction
 * @param interaction
 * @param lng
 */
export async function handleNoPlayerInteraction(interaction: CrowniclesInteraction, lng: Language): Promise<void> {
	await interaction.editReply({
		embeds: [
			new CrowniclesSmallEventEmbed(
				"interactOtherPlayers",
				StringUtils.getRandomTranslation("smallEvents:interactOtherPlayers.no_one", lng),
				interaction.user,
				lng
			)
		]
	});
}

/**
 * Handles the case where the interaction is an effect
 * @param interaction
 * @param packet
 * @param lng
 * @param playerDisplay
 */
export async function handleEffectInteraction(interaction: CrowniclesInteraction, packet: SmallEventInteractOtherPlayersPacket, lng: Language, playerDisplay: string): Promise<void> {
	await interaction.editReply({
		embeds: [
			new CrowniclesSmallEventEmbed(
				"interactOtherPlayers",
				StringUtils.getRandomTranslation(`smallEvents:interactOtherPlayers.effect.${packet.data!.effectId}`, lng, { playerDisplay }),
				interaction.user,
				lng
			)
		]
	});
}

/**
 * Handles the case where the interaction is not an effect
 * @param interaction
 * @param packet
 * @param lng
 * @param playerDisplay
 */
export async function handleOtherInteractions(interaction: CrowniclesInteraction, packet: SmallEventInteractOtherPlayersPacket, lng: Language, playerDisplay: string): Promise<void> {
	const hasPetInfo = packet.data!.petId && packet.data!.petSex;
	const data = packet.data!;
	await interaction.editReply({
		embeds: [
			new CrowniclesSmallEventEmbed(
				"interactOtherPlayers",
				StringUtils.getRandomTranslation(
					`smallEvents:interactOtherPlayers.${InteractOtherPlayerInteraction[packet.playerInteraction!].toLowerCase()}`,
					lng,
					{
						playerDisplay,
						level: data.level,
						class: DisplayUtils.getClassDisplay(data.classId, lng),
						classPlural: DisplayUtils.getClassDisplay(data.classId, lng, true),
						advice: StringUtils.getRandomTranslation("advices:advices", lng),
						petEmote: hasPetInfo ? DisplayUtils.getPetIcon(data.petId!, data.petSex!) : "",
						petName: hasPetInfo ? DisplayUtils.getPetNicknameOrTypeName(data.petName ?? null, data.petId!, data.petSex!, lng) : "",
						guildName: data.guildName,
						weapon: DisplayUtils.getWeaponDisplay(data.weaponId, lng),
						armor: DisplayUtils.getArmorDisplay(data.armorId, lng),
						object: DisplayUtils.getObjectDisplay(data.objectId, lng),
						potion: DisplayUtils.getPotionDisplay(data.potionId, lng),
						leagueEmoji: data.leagueId !== undefined ? CrowniclesIcons.leagues[data.leagueId] : "",
						leagueName: data.leagueId !== undefined ? i18n.t(`models:leagues.${data.leagueId}`, { lng }) : "",
						gloryRank: data.gloryRank,
						gems: data.gems,
						tokens: data.tokens,
						monsterName: data.bossId ? i18n.t(`models:monsters.${data.bossId}.name`, { lng }) : "",
						bossLevel: data.bossLevel
					}
				),
				interaction.user,
				lng
			)
		]
	});
}
