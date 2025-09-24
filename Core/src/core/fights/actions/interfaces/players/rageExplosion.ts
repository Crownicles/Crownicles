import { Fighter } from "../../../fighter/Fighter";
import {
	attackInfo, FightActionController, statsInfo
} from "../../FightActionController";
import { RealPlayerFighter } from "../../../fighter/RealPlayerFighter";
import { NumberChangeReason } from "../../../../../../../Lib/src/constants/LogsConstants";
import { PVEConstants } from "../../../../../../../Lib/src/constants/PVEConstants";
import { FightActionFunc } from "../../../../../data/FightAction";
import { FightActionStatus } from "../../../../../../../Lib/src/types/FightActionStatus";

const use: FightActionFunc = (sender, receiver) => {
	const playerSender = <RealPlayerFighter>sender;
	const damages = Math.round(
		FightActionController.getAttackDamage(getStatsInfo(sender, receiver), sender, getAttackInfo())
		* Math.min(Math.max(playerSender.player.rage, PVEConstants.RAGE_MIN_MULTIPLIER), PVEConstants.RAGE_MAX_DAMAGE + playerSender.player.level)
	);
	playerSender.player.setRage(0, NumberChangeReason.RAGE_EXPLOSION_ACTION)
		.then();
	return {
		attackStatus: FightActionStatus.NORMAL,
		customMessage: true,
		damages
	};
};

export default use;

function getAttackInfo(): attackInfo {
	return {
		minDamage: 10,
		averageDamage: 45,
		maxDamage: 85
	};
}

function getStatsInfo(sender: Fighter, receiver: Fighter): statsInfo {
	return {
		attackerStats: [
			sender.getAttack(),
			sender.getSpeed()
		],
		defenderStats: [
			receiver.getDefense(),
			receiver.getSpeed()
		],
		statsEffect: [
			0.7,
			0.3
		]
	};
}
