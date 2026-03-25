import {
	PetEntities, PetEntity
} from "../../core/database/game/models/PetEntity";
import PlayerMissionsInfo, { PlayerMissionsInfos } from "../../core/database/game/models/PlayerMissionsInfo";
import {
	InventorySlots
} from "../../core/database/game/models/InventorySlot";
import { PlayerActiveObjects } from "../../core/database/game/models/PlayerActiveObjects";
import { FightConstants } from "../../../../Lib/src/constants/FightConstants";
import {
	CrowniclesPacket, makePacket
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandProfilePacketReq,
	CommandProfilePacketRes,
	CommandProfilePlayerNotFound
} from "../../../../Lib/src/packets/commands/CommandProfilePacket";
import { Campaign } from "../../core/missions/Campaign";
import {
	Player, Players
} from "../../core/database/game/models/Player";
import {
	Guild, Guilds
} from "../../core/database/game/models/Guild";
import {
	Pet, PetDataController
} from "../../data/Pet";
import { MapLocationDataController } from "../../data/MapLocation";
import {
	commandRequires, CommandUtils
} from "../../core/utils/CommandUtils";
import { SexTypeShort } from "../../../../Lib/src/constants/StringConstants";
import { ClassConstants } from "../../../../Lib/src/constants/ClassConstants";
import { Effect } from "../../../../Lib/src/types/Effect";
import { TokensConstants } from "../../../../Lib/src/constants/TokensConstants";
import { PlayerBadgesManager } from "../../core/database/game/models/PlayerBadges";
import { getCookingGrade } from "../../../../Lib/src/constants/CookingConstants";
import Home, { Homes } from "../../core/database/game/models/Home";

/**
 * Get the current campaign progression of the player
 */
function getCampaignProgression(missionsInfo: PlayerMissionsInfo): number {
	if (missionsInfo.campaignProgression === 0) {
		return 100;
	}
	return Math.round(Campaign.getAmountOfCampaignCompleted(missionsInfo.campaignBlob) / Campaign.getMaxCampaignNumber() * 100);
}

interface ProfilePetData {
	typeId: number;
	sex: SexTypeShort;
	nickname: string;
	rarity: number;
}

/**
 * Build pet data for profile
 */
function buildPetData(petEntity: PetEntity, petModel: Pet): ProfilePetData {
	return {
		typeId: petModel.id,
		sex: petEntity.sex as SexTypeShort,
		nickname: petEntity.nickname,
		rarity: petModel.rarity
	};
}

/**
 * Resolve pet data from a pet entity, handling null cases
 */
function resolvePetData(petEntity: PetEntity | null): ProfilePetData | undefined {
	if (!petEntity) {
		return undefined;
	}
	const petModel = PetDataController.instance.getById(petEntity.typeId);
	if (!petModel) {
		return undefined;
	}
	return buildPetData(petEntity, petModel);
}

/**
 * Resolve glory rank for a player
 */
async function resolveGloryRank(player: Player): Promise<number> {
	if (player.fightCountdown > FightConstants.FIGHT_COUNTDOWN_MAXIMAL_VALUE) {
		return -1;
	}
	return await Players.getGloryRankById(player.id);
}

/**
 * Resolve map type ID from a destination
 */
function resolveMapTypeId(destinationId: number | null): string | undefined {
	if (!destinationId) {
		return undefined;
	}
	return MapLocationDataController.instance.getById(destinationId)?.type;
}

/**
 * Build effect data for profile
 */
function buildEffectData(player: Player): {
	effect: string;
	timeLeft: number;
	healed: boolean;
	hasTimeDisplay: boolean;
} {
	return {
		effect: player.effectId,
		timeLeft: player.effectEndDate.valueOf() - Date.now(),
		healed: (new Date() >= player.effectEndDate) && player.effectId !== Effect.NO_EFFECT.id,
		hasTimeDisplay: player.isUnderEffect()
	};
}

/**
 * Build fight ranking data for profile
 */
async function buildFightRankingData(player: Player, gloryRank: number): Promise<{
	glory: number;
	gloryRank: number;
	numberOfFighters: number;
	league: number;
} | null> {
	if (player.level < FightConstants.REQUIRED_LEVEL) {
		return null;
	}
	return {
		glory: player.getGloryPoints(),
		gloryRank,
		numberOfFighters: await Players.getNumberOfFightingPlayers(),
		league: player.getLeague().id
	};
}

/**
 * Build stats data for profile
 */
function buildStatsData(player: Player, playerActiveObjects: PlayerActiveObjects): {
	attack: number;
	defense: number;
	speed: number;
	energy: {
		value: number; max: number;
	};
	breath: {
		base: number; max: number; regen: number;
	};
} | null {
	if (player.level < ClassConstants.REQUIRED_LEVEL) {
		return null;
	}
	return {
		attack: player.getCumulativeAttack(playerActiveObjects),
		defense: player.getCumulativeDefense(playerActiveObjects),
		speed: player.getCumulativeSpeed(playerActiveObjects),
		energy: {
			value: player.getCumulativeEnergy(playerActiveObjects),
			max: player.getMaxCumulativeEnergy(playerActiveObjects)
		},
		breath: {
			base: player.getBaseBreath(),
			max: player.getMaxBreath(),
			regen: player.getBreathRegen()
		}
	};
}

/**
 * Build rank data for profile
 */
function buildRankData(rank: number, numberOfPlayers: number, score: number): {
	rank: number;
	numberOfPlayers: number;
	score: number;
	unranked: boolean;
} {
	const isUnranked = rank > numberOfPlayers;
	return {
		rank: isUnranked ? -1 : rank,
		numberOfPlayers,
		score,
		unranked: isUnranked
	};
}

interface ProfileCookingData {
	level: number;
	grade: string;
}

/**
 * Build cooking data for profile (only if home has cooking slots)
 */
function buildCookingData(player: Player, home: Home | null): ProfileCookingData | undefined {
	const hasCooking = home?.getLevel()?.features.cookingSlots;
	if (!hasCooking) {
		return undefined;
	}
	return {
		level: player.cookingLevel,
		grade: getCookingGrade(player.cookingLevel).id
	};
}

interface ProfileTokenData {
	value: number;
	max: number;
}

/**
 * Build token data for profile (only if player level is high enough)
 */
function buildTokenData(player: Player): ProfileTokenData | undefined {
	if (player.level < TokensConstants.LEVEL_TO_UNLOCK) {
		return undefined;
	}
	return {
		value: player.tokens,
		max: TokensConstants.MAX
	};
}

interface ProfileFetchedData {
	guild: Guild | null;
	rank: number;
	numberOfPlayers: number;
	petEntity: PetEntity | null;
	missionsInfo: PlayerMissionsInfo;
	playerActiveObjects: PlayerActiveObjects;
	home: Home | null;
	gloryRank: number;
}

/**
 * Build guild data for profile (guild name)
 */
function buildGuildData(guild: Guild | null): string | undefined {
	return guild?.name ?? undefined;
}

/**
 * Build the full profile response packet from fetched data
 */
async function buildProfilePacket(
	toCheckPlayer: Player,
	data: ProfileFetchedData
): Promise<CommandProfilePacketRes> {
	const petData = resolvePetData(data.petEntity);
	const destinationId = toCheckPlayer.getDestinationId();
	const badges = await PlayerBadgesManager.getOfPlayer(toCheckPlayer.id);
	const cookingData = buildCookingData(toCheckPlayer, data.home);
	const tokenData = buildTokenData(toCheckPlayer);

	return makePacket(CommandProfilePacketRes, {
		keycloakId: toCheckPlayer.keycloakId,
		playerData: {
			badges,
			guild: buildGuildData(data.guild),
			level: toCheckPlayer.level,
			rank: buildRankData(data.rank, data.numberOfPlayers, toCheckPlayer.score),
			classId: toCheckPlayer.class,
			color: toCheckPlayer.getProfileColor() ?? undefined,
			pet: petData,
			destinationId: destinationId ?? undefined,
			mapTypeId: resolveMapTypeId(destinationId),
			effect: buildEffectData(toCheckPlayer),
			fightRanking: await buildFightRankingData(toCheckPlayer, data.gloryRank) ?? undefined,
			missions: {
				gems: data.missionsInfo.gems,
				campaignProgression: getCampaignProgression(data.missionsInfo)
			},
			stats: buildStatsData(toCheckPlayer, data.playerActiveObjects) ?? undefined,
			experience: {
				value: toCheckPlayer.experience,
				max: toCheckPlayer.getExperienceNeededToLevelUp()
			},
			health: {
				value: toCheckPlayer.getHealthValue(),
				max: toCheckPlayer.getMaxHealthBase()
			},
			money: toCheckPlayer.money,
			tokens: tokenData,
			cooking: cookingData
		}
	});
}

export default class ProfileCommand {
	@commandRequires(CommandProfilePacketReq, {
		notBlocked: false,
		disallowedEffects: CommandUtils.DISALLOWED_EFFECTS.NOT_STARTED,
		whereAllowed: CommandUtils.WHERE.EVERYWHERE
	})
	async execute(response: CrowniclesPacket[], player: Player, packet: CommandProfilePacketReq): Promise<void> {
		const toCheckPlayer = await Players.getAskedPlayer(packet.askedPlayer, player);

		if (!toCheckPlayer?.hasStartedToPlay()) {
			response.push(makePacket(CommandProfilePlayerNotFound, {}));
			return;
		}

		// Gather all required data
		const [
			guild,
			rank,
			numberOfPlayers,
			petEntity,
			missionsInfo,
			playerActiveObjects,
			home
		] = await Promise.all([
			toCheckPlayer.guildId ? Guilds.getById(toCheckPlayer.guildId) : null,
			Players.getRankById(toCheckPlayer.id),
			Players.getNbPlayersHaveStartedTheAdventure(),
			toCheckPlayer.petId ? PetEntities.getById(toCheckPlayer.petId) : null,
			PlayerMissionsInfos.getOfPlayer(toCheckPlayer.id),
			InventorySlots.getPlayerActiveObjects(toCheckPlayer.id),
			Homes.getOfPlayer(toCheckPlayer.id)
		]);

		const gloryRank = await resolveGloryRank(toCheckPlayer);

		response.push(await buildProfilePacket(toCheckPlayer, {
			guild, rank, numberOfPlayers, petEntity, missionsInfo, playerActiveObjects, home, gloryRank
		}));
	}
}
