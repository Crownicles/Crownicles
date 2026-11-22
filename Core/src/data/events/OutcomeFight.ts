import Player from "../../core/database/game/models/Player";
import { CrowniclesPacket } from "../../../../Lib/src/packets/CrowniclesPacket";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import { Effect } from "../../../../Lib/src/types/Effect";
import { Locked } from "../../../../Lib/src/locks/withLockedEntities";
import { OutcomeRandomItem } from "./PossibilityOutcome";

/**
 * Consequences of the fight of an outcome, applied once it is won or lost
 */
export type OutcomeFightConsequences = {
	money?: number;
	health?: number;
	experience?: number;
	effect?: string;
	lostTime?: number;
	randomItem?: OutcomeRandomItem;
};

/**
 * Fight an outcome triggers against a monster of a fixed level
 */
export type OutcomeFight = {

	/**
	 * Id of the monster, in Core/resources/monsters
	 */
	monster: string;

	level: number;

	/**
	 * Consequences when the player wins (a draw counts as a win: the opponent gives up)
	 */
	won?: OutcomeFightConsequences;

	lost?: OutcomeFightConsequences;
};

/**
 * Values shown to the player after the fight
 */
export type OutcomeFightConsequencesResult = {
	money: number;
	health: number;
	experience: number;
	effect?: {
		name: string;
		time: number;
	};
};

async function applyFightMoneyUnderLock(money: number | undefined, player: Locked<Player>, response: CrowniclesPacket[]): Promise<number> {
	if (!money) {
		return 0;
	}
	const parameters = {
		response,
		amount: money,
		reason: NumberChangeReason.BIG_EVENT
	};
	await player.addMoney(parameters);
	return parameters.amount;
}

async function applyFightExperienceUnderLock(experience: number | undefined, player: Locked<Player>, response: CrowniclesPacket[]): Promise<number> {
	if (!experience) {
		return 0;
	}
	await player.addExperience({
		amount: experience,
		reason: NumberChangeReason.BIG_EVENT,
		response
	});
	return experience;
}

async function applyFightHealthUnderLock(health: number | undefined, player: Locked<Player>, response: CrowniclesPacket[]): Promise<number> {
	if (!health) {
		return 0;
	}
	await player.addHealth({
		amount: health,
		response,
		reason: NumberChangeReason.BIG_EVENT
	});
	return health;
}

async function applyFightEffectUnderLock(consequences: OutcomeFightConsequences, player: Locked<Player>): Promise<OutcomeFightConsequencesResult["effect"]> {
	if (!consequences.effect) {
		return undefined;
	}
	await player.setLastReportWithEffect(
		consequences.lostTime ?? 0,
		Effect.getById(consequences.effect) ?? Effect.NO_EFFECT,
		NumberChangeReason.BIG_EVENT
	);
	return {
		name: player.effectId,
		time: player.effectDuration
	};
}

/**
 * Apply the consequences of a won or lost outcome fight, except its random item which is given once the result is shown
 * @param consequences - What the player wins or loses, nothing when undefined
 * @param player - The locked player
 * @param response
 */
export async function applyOutcomeFightConsequencesUnderLock(
	consequences: OutcomeFightConsequences | undefined,
	player: Locked<Player>,
	response: CrowniclesPacket[]
): Promise<OutcomeFightConsequencesResult> {
	return {
		money: await applyFightMoneyUnderLock(consequences?.money, player, response),
		experience: await applyFightExperienceUnderLock(consequences?.experience, player, response),
		health: await applyFightHealthUnderLock(consequences?.health, player, response),
		effect: consequences ? await applyFightEffectUnderLock(consequences, player) : undefined
	};
}
