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
	let armorDamages = 0;
	let armorDefense = 0;
	let armorSpeed = 0;

	// Check if the opponent is a player or an AI player
	if (opponent instanceof PlayerFighter || opponent instanceof AiPlayerFighter) {
		const memberActiveObjects = await InventorySlots.getMainSlotsItems(opponent.player.id);
		armorDamages = memberActiveObjects.armor.getAttack();
		armorDefense = memberActiveObjects.armor.getDefense();
		armorSpeed = memberActiveObjects.armor.getSpeed();
	}

	// 15% chance to fail to break the armor
	if (RandomUtils.crowniclesRandom.bool(0.15) || armorDefense === 0) {
		return Promise.resolve({
			assistanceStatus: PetAssistanceState.FAILURE
		});
	}

	const result: PetAssistanceResult = {
		assistanceStatus: PetAssistanceState.SUCCESS
	};

	// Lower the opponent's defense because it has no armor anymore
	FightActionController.applyBuff(result, {
		selfTarget: false,
		stat: FightStatBuffed.DEFENSE,
		operator: FightStatModifierOperation.MULTIPLIER,
		value: (totalDefense - armorDefense) / totalDefense
	}, opponent, undefined);

	// If the opponent had an armor that impacts attack or speed, update the stats accordingly
	if (armorDamages !== 0) {
		FightActionController.applyBuff(result, {
			selfTarget: false,
			stat: FightStatBuffed.ATTACK,
			operator: FightStatModifierOperation.MULTIPLIER,
			value: (totalDamage - armorDamages) / totalDamage
		}, opponent, undefined);
	}
	if (armorSpeed !== 0) {
		FightActionController.applyBuff(result, {
			selfTarget: false,
			stat: FightStatBuffed.SPEED,
			operator: FightStatModifierOperation.MULTIPLIER,
			value: (totalSpeed - armorSpeed) / totalSpeed
		}, opponent, undefined);
	}

	return Promise.resolve(result);
};

export default use;
