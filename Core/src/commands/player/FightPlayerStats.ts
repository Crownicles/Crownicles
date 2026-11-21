import Player from "../../core/database/game/models/Player";
import { InventorySlots } from "../../core/database/game/models/InventorySlot";
import { PetEntities } from "../../core/database/game/models/PetEntity";
import type { SexTypeShort } from "../../../../Lib/src/constants/StringConstants";
import { PetUtils } from "../../core/utils/PetUtils";
import type { FightPlayerStats } from "../../../../Lib/src/types/FightPlayerStats";

/**
 * Get the stats of the player displayed before confirming a fight
 * @param player
 */
export async function getPlayerStats(player: Player): Promise<FightPlayerStats> {
	const playerActiveObjects = await InventorySlots.getMainSlotsItems(player.id);
	const petEntity = await PetEntities.getById(player.petId);

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
			glory: player.getGloryPoints()
		},
		energy: {
			value: player.getCumulativeEnergy(playerActiveObjects),
			max: player.getMaxCumulativeEnergy(playerActiveObjects)
		},
		...player.getCumulativeStats(playerActiveObjects),
		breath: {
			base: player.getBaseBreath(playerActiveObjects),
			max: player.getMaxBreath(playerActiveObjects),
			regen: player.getBreathRegen()
		}
	};
}
