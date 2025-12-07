import { PetEntities } from "../../core/database/game/models/PetEntity";
import PlayerMissionsInfo, { PlayerMissionsInfos } from "../../core/database/game/models/PlayerMissionsInfo";
import { InventorySlots } from "../../core/database/game/models/InventorySlot";
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
import { PetDataController } from "../../data/Pet";
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
 * @param missionsInfo
 */
function getCampaignProgression(missionsInfo: PlayerMissionsInfo): number {
	return missionsInfo.campaignProgression === 0 ? 100 : Math.round(Campaign.getAmountOfCampaignCompleted(missionsInfo.campaignBlob) / Campaign.getMaxCampaignNumber() * 100);
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
		const guild = toCheckPlayer.guildId ? await Guilds.getById(toCheckPlayer.guildId) : null;
		const rank = await Players.getRankById(toCheckPlayer.id);
		const gloryRank = toCheckPlayer.fightCountdown > FightConstants.FIGHT_COUNTDOWN_MAXIMAL_VALUE ? -1 : await Players.getGloryRankById(toCheckPlayer.id);
		const numberOfPlayers = await Players.getNbPlayersHaveStartedTheAdventure();
		const isUnranked = rank > numberOfPlayers;
		const petEntity = toCheckPlayer.petId ? await PetEntities.getById(toCheckPlayer.petId) : null;
		const petModel = toCheckPlayer.petId ? PetDataController.instance.getById(petEntity.typeId) : null;
		const missionsInfo = await PlayerMissionsInfos.getOfPlayer(toCheckPlayer.id);
		const playerActiveObjects = await InventorySlots.getMainSlotsItems(toCheckPlayer.id);
		const badges = toCheckPlayer.badges === "" || !toCheckPlayer.badges ? [] : toCheckPlayer.badges.split(",") as Badge[];
		const destinationId = toCheckPlayer.getDestinationId();

		response.push(makePacket(CommandProfilePacketRes, {
			keycloakId: toCheckPlayer.keycloakId,
			playerData: {
				badges,
				guild: guild?.name,
				level: toCheckPlayer.level,
				rank: {
					rank: isUnranked ? -1 : rank,
					numberOfPlayers,
					score: toCheckPlayer.score,
					unranked: isUnranked
				},
				classId: toCheckPlayer.class,
				color: toCheckPlayer.getProfileColor(),
				pet: petEntity
					? {
						typeId: petModel.id,
						sex: petEntity.sex as SexTypeShort,
						nickname: petEntity.nickname,
						rarity: petModel.rarity
					}
					: null,
				destinationId,
				mapTypeId: destinationId ? MapLocationDataController.instance.getById(destinationId).type : null,
				effect: {
					effect: toCheckPlayer.effectId,
					timeLeft: toCheckPlayer.effectEndDate.valueOf() - Date.now(),
					healed: (new Date() >= toCheckPlayer.effectEndDate) && toCheckPlayer.effectId !== Effect.NO_EFFECT.id,
					hasTimeDisplay: toCheckPlayer.isUnderEffect()
				},
				fightRanking: toCheckPlayer.level >= FightConstants.REQUIRED_LEVEL
					? {
						glory: toCheckPlayer.getGloryPoints(),
						gloryRank,
						numberOfFighters: await Players.getNumberOfFightingPlayers(),
						league: toCheckPlayer.getLeague().id
					}
					: null,
				missions: {
					gems: missionsInfo.gems,
					campaignProgression: getCampaignProgression(missionsInfo)
				},
				stats: toCheckPlayer.level >= ClassConstants.REQUIRED_LEVEL
					? {
						attack: toCheckPlayer.getCumulativeAttack(playerActiveObjects),
						defense: toCheckPlayer.getCumulativeDefense(playerActiveObjects),
						speed: toCheckPlayer.getCumulativeSpeed(playerActiveObjects),
						energy: {
							value: toCheckPlayer.getCumulativeEnergy(),
							max: toCheckPlayer.getMaxCumulativeEnergy()
						},
						breath: {
							base: toCheckPlayer.getBaseBreath(),
							max: toCheckPlayer.getMaxBreath(),
							regen: toCheckPlayer.getBreathRegen()
						}
					}
					: null,
				experience: {
					value: toCheckPlayer.experience,
					max: toCheckPlayer.getExperienceNeededToLevelUp()
				},
				health: {
					value: toCheckPlayer.health,
					max: toCheckPlayer.getMaxHealth()
				},
				money: toCheckPlayer.money,
				tokens: toCheckPlayer.tokens,
				tokensMax: TokensConstants.MAX
			}
		}));
	}
}
