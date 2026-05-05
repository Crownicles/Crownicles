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

	// Metal conducts lightning: more metallic gear on the target means stronger hits
	const receiverMetallicCount = receiver instanceof PlayerFighter || receiver instanceof AiPlayerFighter
		? receiver.metallicItemCount
		: 0;

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
			attackInfo: getAttackInfo(receiverIsPaladin, receiverMetallicCount),
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

function getAttackInfo(receiverIsPaladin: boolean, metallicCount: number): attackInfo {
	// Paladins channel divine power and take reduced damage from celestial energy
	const paladinReduction = receiverIsPaladin ? 0.6 : 1;

	// Each metallic item on the target amplifies the strike (+10% per item)
	const metallicMultiplier = 1 + 0.1 * metallicCount;
	const totalMultiplier = paladinReduction * metallicMultiplier;

	return {
		minDamage: Math.round(30 * totalMultiplier),
		averageDamage: Math.round(45 * totalMultiplier),
		maxDamage: Math.round(85 * totalMultiplier)
	};
}

function getStatsInfo(sender: Fighter, receiver: Fighter): statsInfo {
	return {
		attackerStats: [
			sender.getAttack(),
			sender.getSpeed()
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
