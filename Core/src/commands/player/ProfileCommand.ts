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
import { Guilds } from "../../core/database/game/models/Guild";
import {
	Pet, PetDataController
} from "../../data/Pet";
import { MapLocationDataController } from "../../data/MapLocation";
import {
	commandRequires, CommandUtils
} from "../../core/utils/CommandUtils";
import { SexTypeShort } from "../../../../Lib/src/constants/StringConstants";
import { Badge } from "../../../../Lib/src/types/Badge";
import { ClassConstants } from "../../../../Lib/src/constants/ClassConstants";
import { Effect } from "../../../../Lib/src/types/Effect";
import { TokensConstants } from "../../../../Lib/src/constants/TokensConstants";

/**
 * Get the current campaign progression of the player
 */
function getCampaignProgression(missionsInfo: PlayerMissionsInfo): number {
	if (missionsInfo.campaignProgression === 0) {
		return 100;
	}
	return Math.round(Campaign.getAmountOfCampaignCompleted(missionsInfo.campaignBlob) / Campaign.getMaxCampaignNumber() * 100);
}

/**
 * Build pet data for profile
 */
function buildPetData(petEntity: PetEntity | null, petModel: Pet | null): {
	typeId: number;
	sex: SexTypeShort;
	nickname: string;
	rarity: number;
} | null {
	if (!petEntity || !petModel) {
		return null;
	}
	return {
		typeId: petModel.id,
		sex: petEntity.sex as SexTypeShort,
		nickname: petEntity.nickname,
		rarity: petModel.rarity
	};
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
			value: player.getCumulativeEnergy(),
			max: player.getMaxCumulativeEnergy()
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

/**
 * Parse badges from player data
 */
function parseBadges(badgesString: string | null): Badge[] {
	if (!badgesString || badgesString === "") {
		return [];
	}
	return badgesString.split(",") as Badge[];
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
			playerActiveObjects
		] = await Promise.all([
			toCheckPlayer.guildId ? Guilds.getById(toCheckPlayer.guildId) : null,
			Players.getRankById(toCheckPlayer.id),
			Players.getNbPlayersHaveStartedTheAdventure(),
			toCheckPlayer.petId ? PetEntities.getById(toCheckPlayer.petId) : null,
			PlayerMissionsInfos.getOfPlayer(toCheckPlayer.id),
			InventorySlots.getPlayerActiveObjects(toCheckPlayer.id)
		]);

		const gloryRank = toCheckPlayer.fightCountdown > FightConstants.FIGHT_COUNTDOWN_MAXIMAL_VALUE
			? -1
			: await Players.getGloryRankById(toCheckPlayer.id);

		const petModel = petEntity ? PetDataController.instance.getById(petEntity.typeId) : null;
		const destinationId = toCheckPlayer.getDestinationId();

		response.push(makePacket(CommandProfilePacketRes, {
			keycloakId: toCheckPlayer.keycloakId,
			playerData: {
				badges: parseBadges(toCheckPlayer.badges),
				guild: guild?.name,
				level: toCheckPlayer.level,
				rank: buildRankData(rank, numberOfPlayers, toCheckPlayer.score),
				classId: toCheckPlayer.class,
				color: toCheckPlayer.getProfileColor(),
				pet: buildPetData(petEntity, petModel),
				destinationId,
				mapTypeId: destinationId ? MapLocationDataController.instance.getById(destinationId).type : null,
				effect: buildEffectData(toCheckPlayer),
				fightRanking: await buildFightRankingData(toCheckPlayer, gloryRank),
				missions: {
					gems: missionsInfo.gems,
					campaignProgression: getCampaignProgression(missionsInfo)
				},
				stats: buildStatsData(toCheckPlayer, playerActiveObjects),
				experience: {
					value: toCheckPlayer.experience,
					max: toCheckPlayer.getExperienceNeededToLevelUp()
				},
				health: {
					value: toCheckPlayer.health,
					max: toCheckPlayer.getMaxHealth()
				},
				money: toCheckPlayer.money,
				tokens: toCheckPlayer.level >= TokensConstants.LEVEL_TO_UNLOCK ? toCheckPlayer.tokens : undefined,
				tokensMax: toCheckPlayer.level >= TokensConstants.LEVEL_TO_UNLOCK ? TokensConstants.MAX : undefined
			}
		}));
	}
}
