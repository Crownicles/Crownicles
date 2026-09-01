import Player from "../../core/database/game/models/Player";
import { InventorySlots } from "../../core/database/game/models/InventorySlot";
import { PetEntities } from "../../core/database/game/models/PetEntity";
import type { SexTypeShort } from "../../../../Lib/src/constants/StringConstants";
import { PetUtils } from "../../core/utils/PetUtils";
import TournamentParticipant from "../../core/database/game/models/TournamentParticipant";
import { getEffectiveLevel } from "../../core/tournaments/TournamentRules";
import type { FightPlayerStats } from "../../../../Lib/src/types/FightPlayerStats";

export async function getPlayerStats(player: Player, tournamentParticipant?: TournamentParticipant): Promise<FightPlayerStats> {
	const playerActiveObjects = await InventorySlots.getMainSlotsItems(player.id);
	const petEntity = await PetEntities.getById(player.petId);
	const effectiveLevel = tournamentParticipant
		? getEffectiveLevel(tournamentParticipant.category, player.level)
		: player.level;
	const includePotion = !tournamentParticipant;
	const maxEnergy = player.getMaxCumulativeEnergy(playerActiveObjects, effectiveLevel);

	return {
		pet: petEntity
			? {
				petTypeId: petEntity.typeId!,
				petSex: petEntity.sex as SexTypeShort,
				petNickname: petEntity.nickname,
				isOnExpedition: await PetUtils.isPetOnExpedition(player.id)
			}
			: undefined,
		classId: player.class,
		fightRanking: {
			glory: tournamentParticipant?.getTotalGloryPoints() ?? player.getGloryPoints()
		},
		energy: {
			value: tournamentParticipant ? maxEnergy : player.getCumulativeEnergy(playerActiveObjects),
			max: maxEnergy
		},
		attack: player.getCumulativeAttack(playerActiveObjects, effectiveLevel, includePotion),
		defense: player.getCumulativeDefense(playerActiveObjects, effectiveLevel, includePotion),
		speed: player.getCumulativeSpeed(playerActiveObjects, effectiveLevel, includePotion),
		breath: {
			base: player.getBaseBreath(playerActiveObjects),
			max: player.getMaxBreath(playerActiveObjects),
			regen: player.getBreathRegen()
		}
	};
}
