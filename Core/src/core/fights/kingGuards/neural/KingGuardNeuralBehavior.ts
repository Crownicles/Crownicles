import { ClassBehavior } from "../../AiBehaviorController";
import { AiPlayerFighter } from "../../fighter/AiPlayerFighter";
import { FightView } from "../../FightView";
import { FightAction } from "../../../../data/FightAction";
import { Fighter } from "../../fighter/Fighter";
import { PlayerBaseFighter } from "../../fighter/PlayerBaseFighter";
import { getAiPetBehavior } from "../../PetAssistManager";
import { PetDataController } from "../../../../data/Pet";
import { FightUtils } from "../../../utils/FightUtils";
import { RandomUtils } from "../../../../../../Lib/src/utils/RandomUtils";
import { CrowniclesLogger } from "../../../../../../Lib/src/logs/CrowniclesLogger";
import { KingGuardNeuralModel } from "./KingGuardNeuralModel";
import {
	buildNeuralIndexes, computeNeuralFeatures, NeuralFighterView, NeuralIndexes
} from "./KingGuardNeuralFeatures";

/**
 * Assistance and stats at the fighter's level of a fighter's pet (null without a pet)
 * @param fighter
 */
function toNeuralPetView(fighter: Fighter): NeuralFighterView["pet"] {
	const petTypeId = fighter instanceof PlayerBaseFighter ? fighter.pet?.typeId : undefined;
	if (petTypeId === undefined) {
		return null;
	}
	const petData = PetDataController.instance.getById(petTypeId);
	return {
		assistanceId: getAiPetBehavior(petTypeId)?.id ?? null,
		attack: petData ? FightUtils.calculatePetStatFromForce(petData.force, fighter.level) : 0,
		speed: petData ? FightUtils.calculatePetStatFromSpeed(petData.speed, fighter.level) : 0
	};
}

/**
 * What the network reads from a fighter of a real fight
 * @param fighter
 */
export function toNeuralFighterView(fighter: Fighter): NeuralFighterView {
	const base = fighter.getBaseStats();
	return {
		energy: fighter.getEnergy(),
		maxEnergy: fighter.getMaxEnergy(),
		breath: fighter.getBreath(),
		maxBreath: fighter.getMaxBreath(),
		breathRegen: fighter.getRegenBreath(),
		attack: fighter.getAttack(),
		defense: fighter.getDefense(),
		speed: fighter.getSpeed(),
		baseAttack: base.attack ?? 0,
		baseDefense: base.defense ?? 0,
		baseSpeed: base.speed ?? 0,
		damageMultiplier: fighter.getDamageMultiplier(),
		alterationId: fighter.alteration?.id ?? null,
		historyIds: fighter.fightActionsHistory.map(action => action.id),
		hasNextAction: Boolean(fighter.nextFightAction),
		level: fighter.level,
		classId: fighter instanceof PlayerBaseFighter ? fighter.player.class : -1,
		pet: toNeuralPetView(fighter)
	};
}

/**
 * Moves a fighter can play this turn: the ones it has enough breath for, or all of them when it has none
 * @param fighter
 */
function getPlayableActions(fighter: Fighter): FightAction[] {
	const actions = [...fighter.availableFightActions.values()];
	const affordable = actions.filter(action => action.breath <= fighter.getBreath());
	return affordable.length > 0 ? affordable : actions;
}

/**
 * King guard behavior driven by the policy network. The guard plays the move the network rates best, drawing among
 * the moves rated within the model's tie margin of the best: the guard varies its play without giving up strength.
 * Any failure hands the decision over to the scripted behavior of the guard's class.
 */
export class KingGuardNeuralBehavior implements ClassBehavior {
	private readonly indexes: NeuralIndexes;

	public constructor(private readonly model: KingGuardNeuralModel, private readonly fallback: ClassBehavior | undefined) {
		this.indexes = buildNeuralIndexes(model.vocab);
	}

	/**
	 * The move of the guard: chosen by the network, or by the scripted behavior if the network cannot decide
	 * @param fighter
	 * @param fightView
	 */
	public chooseAction(fighter: AiPlayerFighter, fightView: FightView): FightAction {
		try {
			const action = this.chooseWithNetwork(fighter, fightView);
			if (action) {
				return action;
			}
		}
		catch (error) {
			CrowniclesLogger.errorWithObj("King guard network failed, using the scripted behavior", error);
		}
		if (!this.fallback) {
			throw new Error("No behavior available for the king guard");
		}
		return this.fallback.chooseAction(fighter, fightView);
	}

	/**
	 * The best rated playable move, drawn among the near-ties; null when the network cannot rate any
	 * @param fighter
	 * @param fightView
	 */
	private chooseWithNetwork(fighter: AiPlayerFighter, fightView: FightView): FightAction | null {
		const candidates = getPlayableActions(fighter);
		if (candidates.length === 1) {
			return candidates[0];
		}
		const opponent = fightView.fightController.getDefendingFighter();
		if (!opponent) {
			return null;
		}
		const scores = this.model.scores(computeNeuralFeatures({
			me: toNeuralFighterView(fighter),
			opponent: toNeuralFighterView(opponent),
			turn: fightView.fightController.turn
		}, {
			vocab: this.model.vocab,
			indexes: this.indexes,
			role: "guard",
			style: "strategist"
		}));
		const rated = candidates.flatMap(action => {
			const index = this.indexes.action.get(action.id);
			return index === undefined
				? []
				: [
					{
						action, score: scores[index]
					}
				];
		});
		if (rated.length === 0) {
			return null;
		}
		const best = Math.max(...rated.map(entry => entry.score));
		const nearBest = rated.filter(entry => entry.score >= best - this.model.tieMargin);
		return RandomUtils.crowniclesRandom.pick(nearBest).action;
	}
}
