import {
	MersenneTwister19937, Random
} from "random-js";
import { KingGuardData } from "../../../../data/KingGuard";
import { buildKingGuard } from "../KingGuardLibrary";
import { EloUtils } from "../../../utils/EloUtils";
import { median } from "../../../../../../Lib/src/utils/MathUtils";
import { KingGuardFighter } from "../../fighter/KingGuardFighter";
import { FightController } from "../../FightController";
import { FightsManager } from "../../FightsManager";
import { FightOvertimeBehavior } from "../../FightOvertimeBehavior";
import { PacketContext } from "../../../../../../Lib/src/packets/CrowniclesPacket";
import { FightConstants } from "../../../../../../Lib/src/constants/FightConstants";

/*
 * Simulated tournament estimating the initial rating of the guards of the library.
 * Each round pairs every guard with a guard of close rating (Swiss system) for one silent fight, updating an online Elo used
 * for the pairings only. The ratings are then fitted on all the results at once (Bradley-Terry model, draws counting half).
 */
export const KING_GUARD_CALIBRATION = {
	ROUNDS: 200,

	// K factor of the online Elo, decreasing from the first round to the last one so that the pairings settle
	K_FACTOR: {
		FIRST_ROUND: 96,
		LAST_ROUND: 16
	},

	// Random shift of the ratings used to sort the guards before pairing them, so that a guard does not always meet the same neighbors
	PAIRING_NOISE: 60,

	// Rating before the first round: the higher the level, the stronger the guard
	PRIOR: {
		AT_MIN_LEVEL: 1000,
		PER_LEVEL: 5
	},

	// Virtual draw of each guard against its online rating, so that a guard winning or losing all its fights keeps a finite rating
	VIRTUAL_DRAWS: 1,
	FIT_ITERATIONS: 500,

	// The guards of the lowest level of the library have this median rating
	ANCHOR_RATING: 1000
};

export type CalibrationFight = {
	firstId: number;
	secondId: number;

	// 1 when the first guard won, 0.5 for a draw, 0 when the second guard won
	firstScore: number;
};

export type CalibrationOptions = {
	seed: number;
	rounds?: number;
	onRoundEnd?: (round: number, fights: CalibrationFight[]) => void;
};

// The fight of a calibration is silent: nothing is sent to any front
const CALIBRATION_CONTEXT = {} as PacketContext;

/**
 * Play a silent fight between two guards of the library
 * @returns 1 when the first guard won, 0.5 for a draw, 0 when the second guard won
 */
export async function playKingGuardsFight(first: KingGuardData, second: KingGuardData): Promise<number> {
	const fighter1 = new KingGuardFighter(buildKingGuard(first, first.level));
	const fighter2 = new KingGuardFighter(buildKingGuard(second, second.level));
	await fighter1.loadStats();
	await fighter2.loadStats();
	const fightController = new FightController({
		fighter1, fighter2
	}, {
		overtimeBehavior: FightOvertimeBehavior.END_FIGHT_DRAW,
		context: CALIBRATION_CONTEXT,
		silentMode: true
	});
	let firstScore = 0.5;
	fightController.setEndCallback(fight => {
		firstScore = fight.isADraw() ? 0.5 : fight.getWinnerFighter() === fighter1 ? 1 : 0;
		return Promise.resolve();
	});
	try {
		await fightController.startFight([]);
	}
	finally {
		// The purge of the fights manager only runs in the bot: the tool would keep every fight of the tournament in memory
		FightsManager.unregisterFight(fightController.id);
	}
	return firstScore;
}

/**
 * Fit the ratings of the guards on all the fights of the tournament (minorization-maximization algorithm of the Bradley-Terry model)
 * @param guards
 * @param fights
 * @param priorRatings - Ratings the virtual draws are played against
 */
export function fitKingGuardsRatings(guards: KingGuardData[], fights: CalibrationFight[], priorRatings: Map<number, number>): Map<number, number> {
	const scale = FightConstants.ELO.RATING_SCALE;
	const strengthOf = (rating: number): number => Math.pow(10, rating / scale);
	const strengths = new Map(guards.map(guard => [guard.id, strengthOf(priorRatings.get(guard.id)!)]));
	const scores = new Map(guards.map(guard => [guard.id, KING_GUARD_CALIBRATION.VIRTUAL_DRAWS / 2]));
	for (const fight of fights) {
		scores.set(fight.firstId, scores.get(fight.firstId)! + fight.firstScore);
		scores.set(fight.secondId, scores.get(fight.secondId)! + 1 - fight.firstScore);
	}

	for (let iteration = 0; iteration < KING_GUARD_CALIBRATION.FIT_ITERATIONS; iteration++) {
		const denominators = new Map(guards.map(guard => {
			const strength = strengths.get(guard.id)!;
			return [guard.id, KING_GUARD_CALIBRATION.VIRTUAL_DRAWS / (strength + strengthOf(priorRatings.get(guard.id)!))];
		}));
		for (const fight of fights) {
			const share = 1 / (strengths.get(fight.firstId)! + strengths.get(fight.secondId)!);
			denominators.set(fight.firstId, denominators.get(fight.firstId)! + share);
			denominators.set(fight.secondId, denominators.get(fight.secondId)! + share);
		}
		for (const guard of guards) {
			strengths.set(guard.id, scores.get(guard.id)! / denominators.get(guard.id)!);
		}
	}

	return new Map(guards.map(guard => [guard.id, scale * Math.log10(strengths.get(guard.id)!)]));
}

/**
 * Shift the ratings so that the median rating of the guards of the lowest level is the anchor rating, and round them
 * @param guards
 * @param ratings
 */
export function anchorKingGuardsRatings(guards: KingGuardData[], ratings: Map<number, number>): Map<number, number> {
	const lowestLevelRatings = guards
		.filter(guard => guard.level === FightConstants.KING_GUARD.LIBRARY.MIN_LEVEL)
		.map(guard => ratings.get(guard.id)!);
	const shift = KING_GUARD_CALIBRATION.ANCHOR_RATING - median(lowestLevelRatings);
	return new Map(guards.map(guard => [guard.id, Math.round(ratings.get(guard.id)! + shift)]));
}

/**
 * Put the ratings estimated for the guards added to a library on the scale of the guards already in it, which keep their own
 * initial rating: the ratings are shifted so that, in the median, the guards already in the library get the rating they had
 * @param library - The guards already in the library
 * @param ratings - The ratings estimated by a tournament between all the guards, the new ones included
 */
export function alignKingGuardsRatings(library: KingGuardData[], ratings: Map<number, number>): Map<number, number> {
	const shift = median(library.map(guard => guard.initialGlory - ratings.get(guard.id)!));
	const aligned = new Map([...ratings].map(([id, rating]) => [id, Math.round(rating + shift)]));
	for (const guard of library) {
		aligned.set(guard.id, guard.initialGlory);
	}
	return aligned;
}

/**
 * Play a round of the tournament: every guard fights a guard of close online rating, which is then updated
 */
async function playRound(random: Random, guards: KingGuardData[], params: {
	onlineRatings: Map<number, number>;
	kFactor: number;
}): Promise<CalibrationFight[]> {
	const order = guards
		.map(guard => ({
			guard,
			key: params.onlineRatings.get(guard.id)! + random.real(-KING_GUARD_CALIBRATION.PAIRING_NOISE, KING_GUARD_CALIBRATION.PAIRING_NOISE)
		}))
		.sort((a, b) => a.key - b.key)
		.map(entry => entry.guard);
	const fights: CalibrationFight[] = [];
	for (let index = 0; index + 1 < order.length; index += 2) {
		const [first, second] = random.bool() ? [order[index], order[index + 1]] : [order[index + 1], order[index]];
		const firstScore = await playKingGuardsFight(first, second);
		fights.push({
			firstId: first.id, secondId: second.id, firstScore
		});
		const firstRating = params.onlineRatings.get(first.id)!;
		const secondRating = params.onlineRatings.get(second.id)!;
		const change = params.kFactor * (firstScore - EloUtils.getExpectedScore(firstRating, secondRating));
		params.onlineRatings.set(first.id, firstRating + change);
		params.onlineRatings.set(second.id, secondRating - change);
	}
	return fights;
}

/**
 * Estimate the initial rating of every guard of the library with a simulated tournament
 * @param guards
 * @param options
 */
export async function calibrateKingGuards(guards: KingGuardData[], options: CalibrationOptions): Promise<Map<number, number>> {
	const random = new Random(MersenneTwister19937.seed(options.seed));
	const rounds = options.rounds ?? KING_GUARD_CALIBRATION.ROUNDS;
	const {
		PRIOR, K_FACTOR
	} = KING_GUARD_CALIBRATION;
	const onlineRatings = new Map(guards.map(guard => [
		guard.id,
		PRIOR.AT_MIN_LEVEL + (guard.level - FightConstants.KING_GUARD.LIBRARY.MIN_LEVEL) * PRIOR.PER_LEVEL
	]));
	const fights: CalibrationFight[] = [];
	for (let round = 0; round < rounds; round++) {
		const progress = rounds > 1 ? round / (rounds - 1) : 1;
		const roundFights = await playRound(random, guards, {
			onlineRatings,
			kFactor: K_FACTOR.FIRST_ROUND + (K_FACTOR.LAST_ROUND - K_FACTOR.FIRST_ROUND) * progress
		});
		fights.push(...roundFights);
		options.onRoundEnd?.(round, roundFights);
	}
	return anchorKingGuardsRatings(guards, fitKingGuardsRatings(guards, fights, onlineRatings));
}
