import Player from "../../database/game/models/Player";
import PetEntity from "../../database/game/models/PetEntity";
import {
	Class, ClassDataController
} from "../../../data/Class";
import { PlayerActiveObjects } from "../../database/game/models/PlayerActiveObjects";
import { FightConstants } from "../../../../../Lib/src/constants/FightConstants";
import { PVE_BOSS_ROLES } from "../../../../../Lib/src/constants/PVEConstants";
import { RandomUtils } from "../../../../../Lib/src/utils/RandomUtils";
import { LogsKingGuardFightsRequests } from "../../database/logs/requests/LogsKingGuardFightsRequests";
import { getPveMonsterLevel } from "../../report/ReportPveService";
import {
	getLowLevelPveMonsterLevel, isLowLevelPlayer
} from "../../report/PveMonsterLevel";
import { generateKingGuardEquipment } from "./KingGuardEquipment";
import { generateKingGuardPet } from "./KingGuardPet";

// Upper bound of the seed given to the PvE level algorithm, which reads its last two digits and the following ones
const LEVEL_SEED_MAX = 1_000_000;

export type KingGuard = {
	player: Player;
	guardClass: Class;
	activeObjects: PlayerActiveObjects;
	pet: PetEntity;

	// Level of the player when the guard level was chosen
	playerLevel: number;
};

/**
 * Compute the level of the next king guard of a player, with the same algorithm as the PvE bosses
 * @param player The player who will fight the guard
 */
export async function computeKingGuardLevel(player: Player): Promise<number> {
	const seed = RandomUtils.crowniclesRandom.integer(0, LEVEL_SEED_MAX);
	if (isLowLevelPlayer(player.level)) {
		return Math.max(FightConstants.REQUIRED_LEVEL, getLowLevelPveMonsterLevel({
			ladder: await LogsKingGuardFightsRequests.getGuardLadder(player.keycloakId),
			playerLevel: player.level,
			seed,
			role: PVE_BOSS_ROLES.MIDDLE
		}));
	}
	const baseLevel = await LogsKingGuardFightsRequests.getGuardLevelBase({
		playerKeycloakId: player.keycloakId,
		classId: player.class
	}) ?? player.level;
	return Math.max(FightConstants.REQUIRED_LEVEL, getPveMonsterLevel(baseLevel, seed, false));
}

/**
 * Generate a king guard for a player: an unsaved player of a random class available at its level, with a pet
 * @param player The player who will fight the guard
 */
export async function generateKingGuard(player: Player): Promise<KingGuard> {
	const guard = Player.build({
		keycloakId: FightConstants.KING_GUARD.KEYCLOAK_ID,
		level: await computeKingGuardLevel(player),
		petId: null
	});
	const guardClass = RandomUtils.crowniclesRandom.pick(ClassDataController.instance.getByGroup(guard.getClassGroup()));
	guard.class = guardClass.id;
	return {
		player: guard,
		guardClass,
		activeObjects: generateKingGuardEquipment(guard.level),
		pet: generateKingGuardPet(),
		playerLevel: player.level
	};
}
