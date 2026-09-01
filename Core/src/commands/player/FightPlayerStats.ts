import Player from "../../core/database/game/models/Player";
import { InventorySlots } from "../../core/database/game/models/InventorySlot";
import { PetEntities } from "../../core/database/game/models/PetEntity";
import { SexTypeShort } from "../../../../Lib/src/constants/StringConstants";
import { PetUtils } from "../../core/utils/PetUtils";
import { TournamentManager } from "../../core/tournaments/TournamentManager";
import TournamentParticipant from "../../core/database/game/models/TournamentParticipant";

export type PlayerStats = {
	pet?: {
		petTypeId: number;
		petSex: SexTypeShort;
		petNickname: string;
		isOnExpedition: boolean;
	};
	classId: number;
	fightRanking: { glory: number };
	energy: {
		value: number;
		max: number;
	};
	attack: number;
	defense: number;
	speed: number;
	breath: {
		base: number;
		max: number;
		regen: number;
	};
};

export async function getPlayerStats(player: Player, tournamentParticipant?: TournamentParticipant): Promise<PlayerStats> {
	const playerActiveObjects = await InventorySlots.getMainSlotsItems(player.id);
	const petEntity = await PetEntities.getById(player.petId);
	const effectiveLevel = tournamentParticipant
		? TournamentManager.getEffectiveLevel(tournamentParticipant.category, player.level)
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
