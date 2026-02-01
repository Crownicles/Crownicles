import { PacketContext } from "../../../Lib/src/packets/CrowniclesPacket";
import { DiscordCache } from "../bot/DiscordCache";
import i18n from "../translations/i18n";
import { CrowniclesSmallEventEmbed } from "../messages/CrowniclesSmallEventEmbed";
import {
	escapeUsername, StringUtils
} from "../utils/StringUtils";
import { DiscordCollectorUtils } from "../utils/DiscordCollectorUtils";
import { ReactionCollectorInteractOtherPlayersPacket } from "../../../Lib/src/packets/interaction/ReactionCollectorInteractOtherPlayers";
import { KeycloakUtils } from "../../../Lib/src/keycloak/KeycloakUtils";
import { keycloakConfig } from "../bot/CrowniclesShard";
import { Language } from "../../../Lib/src/Language";
import { CrowniclesIcons } from "../../../Lib/src/CrowniclesIcons";
import { ReactionCollectorReturnTypeOrNull } from "../packetHandlers/handlers/ReactionCollectorHandlers";
import { CrowniclesInteraction } from "../messages/CrowniclesInteraction";
import {
	InteractOtherPlayerInteraction,
	SmallEventInteractOtherPlayersPacket
} from "../../../Lib/src/packets/smallEvents/SmallEventInteractOtherPlayers";
import { DisplayUtils } from "../utils/DisplayUtils";

export async function interactOtherPlayerGetPlayerDisplay(keycloakId: string, rank: number | undefined, lng: Language): Promise<string> {
	const getUser = await KeycloakUtils.getUserByKeycloakId(keycloakConfig, keycloakId);
	return i18n.t(`smallEvents:interactOtherPlayers.playerDisplay${rank ? "Ranked" : "Unranked"}`, {
		lng,
		pseudo: escapeUsername(!getUser.isError && getUser.payload.user.attributes.gameUsername ? getUser.payload.user.attributes.gameUsername[0] : i18n.t("error:unknownPlayer", { lng })),
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
	await interaction.editReply({
		embeds: [
			new CrowniclesSmallEventEmbed(
				"interactOtherPlayers",
				StringUtils.getRandomTranslation(
					`smallEvents:interactOtherPlayers.${InteractOtherPlayerInteraction[packet.playerInteraction!].toLowerCase()}`,
					lng,
					{
						playerDisplay,
						level: packet.data!.level,
						class: DisplayUtils.getClassDisplay(packet.data!.classId, lng),
						classPlural: DisplayUtils.getClassDisplay(packet.data!.classId, lng, true),
						advice: StringUtils.getRandomTranslation("advices:advices", lng),
						petEmote: hasPetInfo ? DisplayUtils.getPetIcon(packet.data!.petId!, packet.data!.petSex!) : "",
						petName: hasPetInfo ? DisplayUtils.getPetNicknameOrTypeName(packet.data!.petName ?? null, packet.data!.petId!, packet.data!.petSex!, lng) : "",
						guildName: packet.data!.guildName,
						weapon: DisplayUtils.getSimpleWeaponDisplay(packet.data!.weaponId, lng),
						armor: DisplayUtils.getSimpleArmorDisplay(packet.data!.armorId, lng),
						object: DisplayUtils.getSimpleObjectDisplay(packet.data!.objectId, lng),
						potion: DisplayUtils.getSimplePotionDisplay(packet.data!.potionId, lng)
					}
				),
				interaction.user,
				lng
			)
		]
	});
}
