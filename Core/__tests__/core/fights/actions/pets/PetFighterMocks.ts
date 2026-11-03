import { PlayerFighter } from "../../../../../src/core/fights/fighter/PlayerFighter";
import type { FightAction } from "../../../../../src/data/FightAction";

export type PetFighterOptions = {
	petTypeId?: number;
	energy?: number;
	maxEnergy?: number;
	defense?: number;
	speed?: number;
	lastActionId?: string;
};

const PET_FIGHTER_LEVEL = 100;

/**
 * Build a player fighter with the real fighter logic (modifiers, damage multipliers, alterations) but without database
 */
export function buildPetFighter(options: PetFighterOptions = {}): PlayerFighter {
	const maxEnergy = options.maxEnergy ?? 1700;
	return Object.assign(Object.create(PlayerFighter.prototype) as PlayerFighter, {
		level: PET_FIGHTER_LEVEL,
		player: { id: 1 },
		...(options.petTypeId === undefined ? {} : { pet: { typeId: options.petTypeId } }),
		stats: {
			energy: options.energy ?? maxEnergy,
			maxEnergy,
			attack: 800,
			defense: options.defense ?? 800,
			speed: options.speed ?? 600,
			breath: 5,
			maxBreath: 10,
			breathRegen: 2
		},
		alteration: null,
		alterationTurn: 0,
		fightActionsHistory: options.lastActionId ? [{ id: options.lastActionId } as FightAction] : [],
		attackModifiers: [],
		defenseModifiers: [],
		speedModifiers: [],
		damageMultipliers: [],
		resistances: [],
		breathRegenModifiers: []
	});
}
