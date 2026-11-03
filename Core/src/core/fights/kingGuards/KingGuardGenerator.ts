import Player from "../../database/game/models/Player";
import PetEntity from "../../database/game/models/PetEntity";
import {
	Class, ClassDataController
} from "../../../data/Class";
import { PlayerActiveObjects } from "../../database/game/models/PlayerActiveObjects";
import { FightConstants } from "../../../../../Lib/src/constants/FightConstants";
import { RandomUtils } from "../../../../../Lib/src/utils/RandomUtils";
import { LogsKingGuardFightsRequests } from "../../database/logs/requests/LogsKingGuardFightsRequests";
import { getPveMonsterLevel } from "../../report/ReportPveService";
import { generateKingGuardEquipment } from "./KingGuardEquipment";
import { generateKingGuardPet } from "./KingGuardPet";

// Upper bound of the seed given to the PvE level algorithm, which reads its last two digits and the following ones
const LEVEL_SEED_MAX = 1_000_000;

/**
 * Forced characteristics of a king guard (test command); the missing ones are drawn as usual
 */
export type KingGuardOverrides = {
	level?: number;
	classId?: number;
};

export type KingGuard = {
	player: Player;
	guardClass: Class;
	activeObjects: PlayerActiveObjects;
	pet: PetEntity;
};

/**
 * Compute the level of the next king guard of a player, with the same algorithm as the PvE bosses
 * @param player The player who will fight the guard
 */
export async function computeKingGuardLevel(player: Player): Promise<number> {
	const baseLevel = await LogsKingGuardFightsRequests.getGuardLevelBase({
		playerKeycloakId: player.keycloakId,
		classId: player.class
	}) ?? player.level;
	return Math.max(
		FightConstants.REQUIRED_LEVEL,
		getPveMonsterLevel(baseLevel, RandomUtils.crowniclesRandom.integer(0, LEVEL_SEED_MAX), false)
	);
}

/**
 * Generate a king guard for a player: an unsaved player of a random class available at its level, with a pet
 * @param player The player who will fight the guard
 * @param overrides Forced level or class of the guard
 */
export async function generateKingGuard(player: Player, overrides: KingGuardOverrides = {}): Promise<KingGuard> {
	const guard = Player.build({
		keycloakId: FightConstants.KING_GUARD.KEYCLOAK_ID,
		level: overrides.level ?? await computeKingGuardLevel(player),
		petId: null
	});
	const forcedClass = overrides.classId === undefined ? undefined : ClassDataController.instance.getById(overrides.classId);
	const guardClass = forcedClass ?? RandomUtils.crowniclesRandom.pick(ClassDataController.instance.getByGroup(guard.getClassGroup()));
	guard.class = guardClass.id;
	return {
		player: guard,
		guardClass,
		activeObjects: generateKingGuardEquipment(guard.level),
		pet: generateKingGuardPet()
	};
}
