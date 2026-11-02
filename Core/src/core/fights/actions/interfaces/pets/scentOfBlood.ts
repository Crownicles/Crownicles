import {
	attackInfo, FightActionController, statsInfo
} from "../../FightActionController";
import { PetAssistanceFunc } from "../../../../../data/PetAssistance";
import {
	PetAssistanceResult, PetAssistanceState
} from "../../../../../../../Lib/src/types/PetAssistanceResult";
import { Fighter } from "../../../fighter/Fighter";
import { FightUtils } from "../../../../utils/FightUtils";
import { FightAlterations } from "../../FightAlterations";
import { BLEEDING_TURNS_TO_HEAL } from "../alterations/bleeding";

/**
 * Share of its max energy under which the opponent is wounded enough for the shark to smell its blood
 */
const BLOOD_SCENT_ENERGY_RATIO = 0.5;

const HUNT_PHASES = {
	// The opponent bleeds, the shark circles around it
	CIRCLING: "circling",

	// The frenzy bite landed or the prey stopped bleeding, the shark leaves for the rest of the fight
	OVER: "over"
} as const;

type HuntPhase = typeof HUNT_PHASES[keyof typeof HUNT_PHASES];

// Hunt progress of each owner's shark, a fighter only lives for one fight
const huntPhases = new WeakMap<Fighter, HuntPhase>();

/*
 * Tuned so that the hunt (wound, bleeding and the frenzy bite when the prey never rests) deals around 90% of the damage
 * dealt by the claws of a tiger over a whole fight
 */
function getWoundAttackInfo(): attackInfo {
	return {
		minDamage: 5,
		averageDamage: 20,
		maxDamage: 35
	};
}

function getFrenzyAttackInfo(): attackInfo {
	return {
		minDamage: 30,
		averageDamage: 80,
		maxDamage: 115
	};
}

function getStatsInfo(sender: Fighter, receiver: Fighter): statsInfo {
	const petStats = FightUtils.getPetFightStats(sender);
	return {
		attackerStats: [
			petStats.force,
			petStats.speed
		],
		defenderStats: [
			receiver.getDefense(),
			receiver.getSpeed()
		],
		statsEffect: [
			0.9,
			0.1
		]
	};
}

function bite(fighter: Fighter, opponent: Fighter, info: attackInfo): number {
	return FightActionController.getAttackDamage(getStatsInfo(fighter, opponent), fighter, info, true);
}

/**
 * Once the opponent is wounded, the shark bites it and makes it bleed
 */
function smellBlood(fighter: Fighter, opponent: Fighter): PetAssistanceResult | null {
	if (opponent.getEnergy() >= opponent.getMaxEnergy() * BLOOD_SCENT_ENERGY_RATIO || opponent.hasFightAlteration()) {
		return null;
	}

	const result: PetAssistanceResult = {
		damages: bite(fighter, opponent, getWoundAttackInfo()),
		assistanceStatus: PetAssistanceState.GENERAL_EFFECT
	};
	FightActionController.applyAlteration(result, {
		selfTarget: false,
		alteration: FightAlterations.BLEEDING
	}, opponent);
	huntPhases.set(fighter, HUNT_PHASES.CIRCLING);
	return result;
}

/**
 * A prey that stops its bleeding (by resting) escapes, one that bleeds until the end gets the frenzy bite
 */
function circleBleedingPrey(fighter: Fighter, opponent: Fighter): PetAssistanceResult | null {
	if (opponent.alteration?.id !== FightAlterations.BLEEDING) {
		huntPhases.set(fighter, HUNT_PHASES.OVER);
		return { assistanceStatus: PetAssistanceState.FAILURE };
	}
	if (opponent.alterationTurn < BLEEDING_TURNS_TO_HEAL) {
		return null;
	}

	huntPhases.set(fighter, HUNT_PHASES.OVER);
	return {
		damages: bite(fighter, opponent, getFrenzyAttackInfo()),
		assistanceStatus: PetAssistanceState.SUCCESS
	};
}

const use: PetAssistanceFunc = (fighter, opponent, _turn, _fightController): Promise<PetAssistanceResult | null> => {
	switch (huntPhases.get(fighter)) {
		case HUNT_PHASES.OVER:
			return Promise.resolve(null);
		case HUNT_PHASES.CIRCLING:
			return Promise.resolve(circleBleedingPrey(fighter, opponent));
		default:
			return Promise.resolve(smellBlood(fighter, opponent));
	}
};

export default use;
