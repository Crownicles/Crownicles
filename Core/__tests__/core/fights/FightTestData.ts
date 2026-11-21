import {
	FightAction, FightActionDataController
} from "../../../src/data/FightAction";
import {
	FightAlteration, FightAlterationDataController
} from "../../../src/data/FightAlteration";
import {
	Monster, MonsterDataController
} from "../../../src/data/Monster";

/**
 * Get a value the test relies on, failing the test with an explicit message when it is missing
 * @param value
 * @param description
 */
export function required<T>(value: T | null | undefined, description: string): T {
	if (value === null || value === undefined) {
		throw new Error(`Missing ${description}`);
	}
	return value;
}

export function fightActionById(id: string): FightAction {
	return required(FightActionDataController.instance.getById(id), `fight action ${id}`);
}

export function fightAlterationById(id: string): FightAlteration {
	return required(FightAlterationDataController.instance.getById(id), `fight alteration ${id}`);
}

export function monsterById(id: string): Monster {
	return required(MonsterDataController.instance.getById(id), `monster ${id}`);
}
