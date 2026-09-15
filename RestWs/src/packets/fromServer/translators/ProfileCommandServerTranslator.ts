import { fromServerTranslator } from "../FromServerTranslator";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandProfilePacketRes,
	CommandProfilePlayerNotFound
} from "../../../../../Lib/src/packets/commands/CommandProfilePacket";
import { KeycloakUtils } from "../../../../../Lib/src/keycloak/KeycloakUtils";
import { keycloakConfig } from "../../../index";
import { escapeUsername } from "../../../../../Lib/src/utils/StringUtils";
import { ProfileRes } from "../../../../../WsPackets/src/fromServer/profile/ProfileRes";
import {
	asyncMakeFromServerPacket, makeFromServerPacket
} from "../../../../../WsPackets/src/MakePackets";
import { PlayerNotFound } from "../../../../../WsPackets/src/fromServer/common/PlayerNotFound";

type ProfilePlayerData = CommandProfilePacketRes["playerData"];
type ProfileStats = NonNullable<ProfileRes["stats"]>;
type ProfilePet = NonNullable<ProfileRes["pet"]>;
type ProfileFightRanking = NonNullable<ProfileRes["fightRanking"]>;
type ProfileCooking = NonNullable<ProfileRes["cooking"]>;

function translateValueAndMax(value: ProfilePlayerData["health"]): ProfileRes["health"] {
	return {
		value: value.value,
		max: value.max
	};
}

function translateStats(stats: NonNullable<ProfilePlayerData["stats"]>): ProfileStats {
	return {
		breath: {
			max: stats.breath.max,
			base: stats.breath.base,
			regen: stats.breath.regen
		},
		attack: stats.attack,
		defense: stats.defense,
		speed: stats.speed,
		energy: {
			max: stats.energy.max,
			value: stats.energy.value
		}
	};
}

function translatePet(pet: NonNullable<ProfilePlayerData["pet"]>): ProfilePet {
	return {
		sex: pet.sex,
		rarity: pet.rarity,
		typeId: pet.typeId,
		nickname: pet.nickname
	};
}

function translateFightRanking(fightRanking: NonNullable<ProfilePlayerData["fightRanking"]>): ProfileFightRanking {
	return {
		glory: fightRanking.glory,
		gloryRank: fightRanking.gloryRank,
		numberOfFighters: fightRanking.numberOfFighters,
		league: fightRanking.league
	};
}

function translateCooking(cooking: NonNullable<ProfilePlayerData["cooking"]>): ProfileCooking {
	return {
		level: cooking.level,
		grade: cooking.grade,
		experience: translateValueAndMax(cooking.experience)
	};
}

export function translateProfileData(pseudo: string, playerData: ProfilePlayerData): ProfileRes {
	return makeFromServerPacket(ProfileRes, {
		pseudo,
		health: translateValueAndMax(playerData.health),
		experience: translateValueAndMax(playerData.experience),
		badges: playerData.badges,
		guild: playerData.guild,
		classId: playerData.classId,
		color: playerData.color,
		level: playerData.level,
		rank: {
			rank: playerData.rank.rank,
			numberOfPlayers: playerData.rank.numberOfPlayers,
			score: playerData.rank.score,
			unranked: playerData.rank.unranked
		},
		money: playerData.money,
		...playerData.tokens ? { tokens: translateValueAndMax(playerData.tokens) } : {},
		...playerData.cooking ? { cooking: translateCooking(playerData.cooking) } : {},
		effect: {
			effect: playerData.effect.effect,
			healed: playerData.effect.healed,
			timeLeft: playerData.effect.timeLeft,
			hasTimeDisplay: playerData.effect.hasTimeDisplay
		},
		missions: {
			gems: playerData.missions.gems,
			campaignProgression: playerData.missions.campaignProgression
		},
		mapTypeId: playerData.mapTypeId,
		destinationId: playerData.destinationId,
		...playerData.pet ? { pet: translatePet(playerData.pet) } : {},
		...playerData.stats ? { stats: translateStats(playerData.stats) } : {},
		...playerData.fightRanking ? { fightRanking: translateFightRanking(playerData.fightRanking) } : {}
	});
}

export default class ProfileCommandServerTranslator {
	@fromServerTranslator(CommandProfilePacketRes, ProfileRes)
	public static async translate(_context: PacketContext, packet: CommandProfilePacketRes): Promise<ProfileRes> {
		const user = await KeycloakUtils.getUserByKeycloakId(keycloakConfig, packet.keycloakId);
		if (user.isError) {
			throw "Error when retrieving the player";
		}

		return translateProfileData(escapeUsername(user.payload.user.attributes.gameUsername[0]), packet.playerData);
	}

	@fromServerTranslator(CommandProfilePlayerNotFound, PlayerNotFound)
	public static translateProfileNotFound(_context: PacketContext, _packet: CommandProfilePlayerNotFound): Promise<PlayerNotFound> {
		return asyncMakeFromServerPacket(PlayerNotFound, {});
	}
}
