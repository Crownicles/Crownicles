import { Fighter } from "../../../fighter/Fighter";
import {
	attackInfo, FightActionController, statsInfo
} from "../../FightActionController";
import { FightAlterations } from "../../FightAlterations";
import { FightActionFunc } from "../../../../../data/FightAction";
import { simpleDamageFightAction } from "../../templates/SimpleDamageFightActionTemplate";
import { RandomUtils } from "../../../../../../../Lib/src/utils/RandomUtils";
import { PlayerFighter } from "../../../fighter/PlayerFighter";
import { AiPlayerFighter } from "../../../fighter/AiPlayerFighter";
import { ClassConstants } from "../../../../../../../Lib/src/constants/ClassConstants";

function isPaladin(fighter: Fighter): boolean {
	if (!(fighter instanceof PlayerFighter || fighter instanceof AiPlayerFighter)) {
		return false;
	}
	return fighter.player.class === ClassConstants.CLASSES_ID.PALADIN
		|| fighter.player.class === ClassConstants.CLASSES_ID.LUMINOUS_PALADIN;
}

const use: FightActionFunc = (sender, receiver) => {
	// Paladins channel divine power and resist celestial energy
	const receiverIsPaladin = isPaladin(receiver);

	const result = simpleDamageFightAction(
		{
			sender,
			receiver
		},
		{
			critical: 0,
			failure: 0
		},
		{
			attackInfo: getAttackInfo(receiverIsPaladin),
			statsInfo: getStatsInfo(sender, receiver)
		}
	);

	// 35% chance to paralyze the defender, paladins are immune (their faith shields them from divine paralysis)
	if (!receiverIsPaladin && RandomUtils.crowniclesRandom.bool(0.35)) {
		FightActionController.applyAlteration(result, {
			selfTarget: false,
			alteration: FightAlterations.PARALYZED
		}, receiver);
	}

	return {
		...result,
		customMessage: true
	};
};

export default use;

function getAttackInfo(receiverIsPaladin: boolean): attackInfo {
	// Paladins channel divine power and take reduced damage from celestial energy
	const paladinReduction = receiverIsPaladin ? 0.6 : 1;
	return {
		minDamage: Math.round(30 * paladinReduction),
		averageDamage: Math.round(45 * paladinReduction),
		maxDamage: Math.round(85 * paladinReduction)
	};
}

function getStatsInfo(sender: Fighter, receiver: Fighter): statsInfo {
	// Lightning is attracted to fast targets: the faster the receiver, the more damage
	return {
		attackerStats: [
			sender.getAttack(),
			sender.getSpeed() + receiver.getSpeed()
		],
		defenderStats: [
			receiver.getDefense() * 0.5,
			receiver.getDefense() * 0.3
		],
		statsEffect: [
			0.3,
			0.7
		]
	};
}
