import { fromServerTranslator } from "../FromServerTranslator";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import {
	ProfileNotFound, ProfileRes
} from "../../../@types/protobufs-server";
import {
	CommandProfilePacketRes,
	CommandProfilePlayerNotFound
} from "../../../../../Lib/src/packets/commands/CommandProfilePacket";
import { KeycloakUtils } from "../../../../../Lib/src/keycloak/KeycloakUtils";
import { keycloakConfig } from "../../../index";
import { escapeUsername } from "../../../../../Lib/src/utils/StringUtils";

export default class ProfileCommandServerTranslator {
	@fromServerTranslator(CommandProfilePacketRes, ProfileRes)
	public static async translate(_context: PacketContext, packet: CommandProfilePacketRes): Promise<ProfileRes> {
		const user = await KeycloakUtils.getUserByKeycloakId(keycloakConfig, packet.keycloakId);
		if (user.isError) {
			throw "Error when retrieving the player";
		}

		return ProfileRes.create({
			pseudo: escapeUsername(user.payload.user.attributes.gameUsername[0]),
			health: {
				value: packet.playerData.health.value,
				max: packet.playerData.health.max
			},
			experience: {
				value: packet.playerData.experience.value,
				max: packet.playerData.experience.max
			},
			badges: packet.playerData.badges,
			guild: packet.playerData.guild,
			classId: packet.playerData.classId,
			color: packet.playerData.color,
			level: packet.playerData.level,
			rank: {
				rank: packet.playerData.rank.rank,
				numberOfPlayers: packet.playerData.rank.numberOfPlayers,
				score: packet.playerData.rank.score,
				unranked: packet.playerData.rank.unranked
			},
			money: packet.playerData.money,
			effect: {
				effect: packet.playerData.effect.effect,
				healed: packet.playerData.effect.healed,
				timeLeft: packet.playerData.effect.timeLeft,
				hasTimeDisplay: packet.playerData.effect.hasTimeDisplay
			},
			pet: packet.playerData.pet
				? {
					sex: packet.playerData.pet.sex,
					rarity: packet.playerData.pet.rarity,
					typeId: packet.playerData.pet.typeId,
					nickname: packet.playerData.pet.nickname
				}
				: undefined,
			stats: packet.playerData.stats
				? {
					breath: {
						max: packet.playerData.stats.breath.max,
						base: packet.playerData.stats.breath.base,
						regen: packet.playerData.stats.breath.regen
					},
					attack: packet.playerData.stats.attack,
					defense: packet.playerData.stats.defense,
					speed: packet.playerData.stats.speed,
					energy: {
						max: packet.playerData.stats?.energy.max,
						value: packet.playerData.stats?.energy.value
					}
				}
				: undefined,
			missions: {
				gems: packet.playerData.missions.gems,
				campaignProgression: packet.playerData.missions.campaignProgression
			},
			fightRanking: packet.playerData.fightRanking
				? {
					glory: packet.playerData.fightRanking.glory,
					league: packet.playerData.fightRanking.league
				}
				: undefined,
			mapTypeId: packet.playerData.mapTypeId,
			destinationId: packet.playerData.destinationId
		});
	}

	@fromServerTranslator(CommandProfilePlayerNotFound, ProfileNotFound)
	public static translateProfileNotFound(_context: PacketContext, _packet: CommandProfilePlayerNotFound): Promise<ProfileNotFound> {
		return Promise.resolve(ProfileNotFound.create({}));
	}
}
