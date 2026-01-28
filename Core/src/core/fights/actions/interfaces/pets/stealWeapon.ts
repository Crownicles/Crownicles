import {
	PetAssistanceResult, PetAssistanceState
} from "../../../../../../../Lib/src/types/PetAssistanceResult";
import { PetAssistanceFunc } from "../../../../../data/PetAssistance";
import { FightActionController } from "../../FightActionController";
import { FightStatBuffed } from "../../../../../../../Lib/src/types/FightActionResult";
import { FightStatModifierOperation } from "../../../../../../../Lib/src/types/FightStatModifierOperation";
import { RandomUtils } from "../../../../../../../Lib/src/utils/RandomUtils";
import { PlayerFighter } from "../../../fighter/PlayerFighter";
import { AiPlayerFighter } from "../../../fighter/AiPlayerFighter";
import { InventorySlots } from "../../../../database/game/models/InventorySlot";

const use: PetAssistanceFunc = async (_fighter, opponent, turn, _fightController): Promise<PetAssistanceResult | null> => {
	// Execute at the start of the fight
	if (turn > 2) {
		return null;
	}
	const totalDamage = opponent.getAttack();
	const totalDefense = opponent.getDefense();
	const totalSpeed = opponent.getSpeed();
	let weaponDamages = 0;
	let weaponDefense = 0;
	let weaponSpeed = 0;

	// Check if the opponent is a player or an AI player
	if (opponent instanceof PlayerFighter || opponent instanceof AiPlayerFighter) {
		const memberActiveObjects = await InventorySlots.getMainSlotsItems(opponent.player.id);
		weaponDamages = memberActiveObjects.weapon.getAttack();
		weaponDefense = memberActiveObjects.weapon.getDefense();
		weaponSpeed = memberActiveObjects.weapon.getSpeed();
	}

	// 10% chance to fail to steal the weapon
	if (RandomUtils.crowniclesRandom.bool(0.1) || weaponDamages === 0) {
		return Promise.resolve({
			assistanceStatus: PetAssistanceState.FAILURE
		});
	}

	const result: PetAssistanceResult = {
		assistanceStatus: PetAssistanceState.SUCCESS
	};

	// Lower the opponent's attack because it has no weapon anymore
	FightActionController.applyBuff(result, {
		selfTarget: false,
		stat: FightStatBuffed.ATTACK,
		operator: FightStatModifierOperation.MULTIPLIER,
		value: (totalDamage - weaponDamages) / totalDamage
	}, opponent, undefined);

	// If the opponent had a weapon that impacts defense or speed, update the stats accordingly
	if (weaponDefense !== 0) {
		FightActionController.applyBuff(result, {
			selfTarget: false,
			stat: FightStatBuffed.DEFENSE,
			operator: FightStatModifierOperation.MULTIPLIER,
			value: (totalDefense - weaponDefense) / totalDefense
		}, opponent, undefined);
	}
	if (weaponSpeed !== 0) {
		FightActionController.applyBuff(result, {
			selfTarget: false,
			stat: FightStatBuffed.SPEED,
			operator: FightStatModifierOperation.MULTIPLIER,
			value: (totalSpeed - weaponSpeed) / totalSpeed
		}, opponent, undefined);
	}

	return Promise.resolve(result);
};

export default use;
