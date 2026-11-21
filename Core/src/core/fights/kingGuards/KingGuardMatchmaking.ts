import Player from "../../database/game/models/Player";
import { KingGuardStates } from "../../database/game/models/KingGuardState";
import { LogsKingGuardFightsRequests } from "../../database/logs/requests/LogsKingGuardFightsRequests";
import {
	KingGuardData, KingGuardDataController
} from "../../../data/KingGuard";
import { FightConstants } from "../../../../../Lib/src/constants/FightConstants";
import { RandomUtils } from "../../../../../Lib/src/utils/RandomUtils";

/**
 * Give their initial rating to the guards of the library missing from the king_guards table, when the bot starts
 */
export async function insertMissingKingGuards(): Promise<void> {
	await KingGuardStates.insertMissing(KingGuardDataController.instance.getAll());
}

/**
 * Choose the guard a player fights, pure Elo whatever their levels: one of the guards whose rating is the closest to the one
 * of the player, drawn at random so that nobody can aim at a given guard, leaving out the last guards the player fought
 * @param player
 */
export async function pickKingGuard(player: Player): Promise<KingGuardData> {
	const library = KingGuardDataController.instance;
	const {
		CANDIDATES, RECENT_GUARDS_EXCLUDED
	} = FightConstants.KING_GUARD.RATING;
	const recentGuardIds = new Set(await LogsKingGuardFightsRequests.getLastGuardIds(player.keycloakId, RECENT_GUARDS_EXCLUDED));
	const candidates = await KingGuardStates.findClosest({
		rating: player.getGuardGloryPoints(),
		guardIds: library.getIds().filter(guardId => !recentGuardIds.has(guardId)),
		count: CANDIDATES
	});
	return library.getById(RandomUtils.crowniclesRandom.pick(candidates).id)!;
}
