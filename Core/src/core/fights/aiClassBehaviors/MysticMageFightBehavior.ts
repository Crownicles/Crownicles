import { ClassBehavior } from "../AiBehaviorController";
import { AiPlayerFighter } from "../fighter/AiPlayerFighter";
import { FightView } from "../FightView";
import {
	FightAction, FightActionDataController
} from "../../../data/FightAction";
import { FightConstants } from "../../../../../Lib/src/constants/FightConstants";
import { RandomUtils } from "../../../../../Lib/src/utils/RandomUtils";

class MysticMageFightBehavior implements ClassBehavior {
	private cursedAttackUsed = false;

	private cursedAttackTurn = RandomUtils.crowniclesRandom.integer(7, 15);

	chooseAction(me: AiPlayerFighter, fightView: FightView): FightAction {
		const opponent = fightView.fightController.getDefendingFighter();
		const actions = FightConstants.FIGHT_ACTIONS.PLAYER;

		// Early return if no opponent (should not happen in normal gameplay)
		if (!opponent) {
			return FightActionDataController.instance.getById(actions.BREATH_TAKING_ATTACK)!;
		}

		/*
		 * Dark attack if:
		 * - opponent is charging a two-turn attack without alterations
		 * - player is dying soon
		 */
		const lastOpponentActionId = opponent.getLastFightActionUsed()?.id;
		if (
			me.getBreath() >= FightActionDataController.getFightActionBreathCost(FightConstants.FIGHT_ACTIONS.PLAYER.DARK_ATTACK)
			&& (

				// Case 1: Cancel opponent's two-turn attack
				lastOpponentActionId !== undefined && [
					FightConstants.FIGHT_ACTIONS.PLAYER.RESTING,
					FightConstants.FIGHT_ACTIONS.PLAYER.CANON_ATTACK,
					FightConstants.FIGHT_ACTIONS.PLAYER.CHARGE_ULTIMATE_ATTACK,
					FightConstants.FIGHT_ACTIONS.PLAYER.CHARGE_CHARGING_ATTACK
				].includes(lastOpponentActionId)
				&& !opponent.hasFightAlteration()

				// Case 2: Player is dying
				|| me.getEnergy() < 150 && opponent.getEnergy() > 300
			)
		) {
			return FightActionDataController.instance.getById(actions.DARK_ATTACK)!;
		}

		/*
		 * Fire attack if enough breath and no alteration
		 * After turn 13, skip if cursed attack has not been used
		 */
		if (
			(!opponent.hasFightAlteration() || opponent.alteration?.id === FightConstants.FIGHT_ACTIONS.ALTERATION.BURNED)
			&& me.getBreath() >= FightActionDataController.getFightActionBreathCost(FightConstants.FIGHT_ACTIONS.PLAYER.FIRE_ATTACK)
			&& fightView.fightController.turn > 1
			&& (fightView.fightController.turn <= this.cursedAttackTurn
				|| this.cursedAttackUsed)
		) {
			return FightActionDataController.instance.getById(actions.FIRE_ATTACK)!;
		}

		// Poison attack if opponent < 65 HP or if we are in the first turn
		if (
			opponent.getEnergy() < 65
			&& me.getBreath() < FightActionDataController.getFightActionBreathCost(FightConstants.FIGHT_ACTIONS.PLAYER.POISONOUS_ATTACK) + 3
			&& me.getBreath() >= FightActionDataController.getFightActionBreathCost(FightConstants.FIGHT_ACTIONS.PLAYER.POISONOUS_ATTACK)
			|| fightView.fightController.turn <= 1
			&& !opponent.hasFightAlteration()
		) {
			return FightActionDataController.instance.getById(actions.POISONOUS_ATTACK)!;
		}

		if (
			!opponent.hasFightAlteration()
			&& (fightView.fightController.turn === 2
				|| (
					me.getBreath() >= FightActionDataController.getFightActionBreathCost(FightConstants.FIGHT_ACTIONS.PLAYER.CURSED_ATTACK)
					&& (opponent.getEnergy() < 120
						|| (opponent.getEnergy() > 500
							&& (!this.cursedAttackUsed
								|| RandomUtils.crowniclesRandom.bool(0.2))
							&& fightView.fightController.turn > this.cursedAttackTurn)
					)
				)
			)
		) {
			this.cursedAttackUsed = true;
			return FightActionDataController.instance.getById(actions.CURSED_ATTACK)!;
		}

		// If breath > 10, always use dark attack
		if (me.getBreath() > 10 && opponent.hasFightAlteration()) {
			return FightActionDataController.instance.getById(actions.DARK_ATTACK)!;
		}

		// If enough breath for dark attack, random choice between dark and breathtaking
		if (me.getBreath() >= 8) {
			return RandomUtils.crowniclesRandom.bool(0.3)
				? FightActionDataController.instance.getById(actions.DARK_ATTACK)!
				: FightActionDataController.instance.getById(actions.BREATH_TAKING_ATTACK)!;
		}

		// Default to breathtaking attack
		return FightActionDataController.instance.getById(actions.BREATH_TAKING_ATTACK)!;
	}
}

export default MysticMageFightBehavior;
