import { FightConstants } from "../../../../../../Lib/src/constants/FightConstants";
import { NeuralVocabulary } from "./KingGuardNeuralModel";

/**
 * What the network reads from a fighter. Built from a real fighter by `toNeuralFighterView`, or from a recorded
 * state in the tests
 */
export type NeuralFighterView = {
	energy: number;
	maxEnergy: number;
	breath: number;
	maxBreath: number;
	breathRegen: number;
	attack: number;
	defense: number;
	speed: number;
	baseAttack: number;
	baseDefense: number;
	baseSpeed: number;
	damageMultiplier: number;
	alterationId: string | null;
	historyIds: string[];
	hasNextAction: boolean;
	level: number;
	classId: number;

	// Assistance of the fighter's pet and its stats at the fighter's level (null without a pet)
	pet: {
		assistanceId: string | null;
		attack: number;
		speed: number;
	} | null;
};

export type NeuralRole = "attacker" | "guard" | "pvpDefender";

export type NeuralStyle = "strategist" | "aggressive" | "prudent";

/**
 * Indexes of every vocabulary of the model
 */
export type NeuralIndexes = {
	action: Map<string, number>;
	alteration: Map<string, number>;
	assistance: Map<string, number>;
	classes: Map<number, number>;
};

export function buildNeuralIndexes(vocab: NeuralVocabulary): NeuralIndexes {
	return {
		action: new Map(vocab.actionIds.map((id, i) => [id, i])),
		alteration: new Map(vocab.alterationIds.map((id, i) => [id, i])),
		assistance: new Map(vocab.assistIds.map((id, i) => [id, i])),
		classes: new Map(vocab.classes.map((id, i) => [id, i]))
	};
}

const BASE_FEATURES = 11;
const STAT_FEATURES = 15;
const PET_STAT_FEATURES = 4;

/**
 * Number of inputs of a model with this vocabulary
 */
export function getNeuralInputSize(vocab: NeuralVocabulary): number {
	const actions = vocab.actionIds.length;
	const alterations = vocab.alterationIds.length;
	const classes = vocab.classes.length;
	const assistances = vocab.assistIds.length + 1;
	return BASE_FEATURES + 2 * alterations + 3 * actions + classes + 1
		+ STAT_FEATURES + classes
		+ actions + 2
		+ 2 * assistances + PET_STAT_FEATURES + vocab.roles.length + vocab.styles.length;
}

// Log of a ratio of two stats, both floored to 1 (state features)
function ratio(x: number, y: number): number {
	return Math.log(Math.max(1, x) / Math.max(1, y));
}

// Log of a ratio of two non negative quantities shifted by one (stat changes, races, pets)
function logRatio(x: number, y: number): number {
	return Math.log((Math.max(0, x) + 1) / (Math.max(0, y) + 1));
}

function setOneHot(x: Float32Array, offset: number, index: number | undefined): void {
	if (index !== undefined) {
		x[offset + index] = 1;
	}
}

function addHistoryCounts(x: Float32Array, offset: number, historyIds: string[], indexes: NeuralIndexes): void {
	for (const id of historyIds) {
		const i = indexes.action.get(id);
		if (i !== undefined) {
			x[offset + i] = Math.min(1, x[offset + i] + 0.2);
		}
	}
}

function lastActionIndex(fighter: NeuralFighterView, indexes: NeuralIndexes): number | undefined {
	return fighter.historyIds.length > 0 ? indexes.action.get(fighter.historyIds[fighter.historyIds.length - 1]) : undefined;
}

function countGodMoves(historyIds: string[]): number {
	return historyIds.filter(id => FightConstants.GOD_MOVES.includes(id)).length;
}

/**
 * State, alterations, last moves, move counts and classes (first block, shared with the earlier models)
 */
function writeStateFeatures(x: Float32Array, me: NeuralFighterView, opponent: NeuralFighterView, turn: number, indexes: NeuralIndexes): number {
	const myEnergy = me.energy / me.maxEnergy;
	const opponentEnergy = opponent.energy / opponent.maxEnergy;
	x[0] = 1;
	x[1] = myEnergy;
	x[2] = opponentEnergy;
	x[3] = myEnergy - opponentEnergy;
	x[4] = me.breath / me.maxBreath;
	x[5] = me.breath / 16;
	x[6] = opponent.breath / opponent.maxBreath;
	x[7] = turn / FightConstants.MAX_TURNS;
	x[8] = ratio(me.speed, opponent.speed);
	x[9] = ratio(me.attack, opponent.defense);
	x[10] = ratio(opponent.attack, me.defense);
	let o = BASE_FEATURES;
	const alterations = indexes.alteration.size;
	const actions = indexes.action.size;
	setOneHot(x, o, me.alterationId ? indexes.alteration.get(me.alterationId) : undefined);
	o += alterations;
	setOneHot(x, o, opponent.alterationId ? indexes.alteration.get(opponent.alterationId) : undefined);
	o += alterations;
	setOneHot(x, o, lastActionIndex(me, indexes));
	o += actions;
	setOneHot(x, o, lastActionIndex(opponent, indexes));
	o += actions;
	addHistoryCounts(x, o, me.historyIds, indexes);
	o += actions;
	setOneHot(x, o, indexes.classes.get(opponent.classId));
	o += indexes.classes.size;
	x[o++] = (countGodMoves(me.historyIds) + countGodMoves(opponent.historyIds)) / 2;
	return o;
}

/**
 * Stat changes, damage multipliers, energy races, follow-up moves and breath (second block)
 */
function writeStatFeatures(x: Float32Array, start: number, me: NeuralFighterView, opponent: NeuralFighterView, indexes: NeuralIndexes): number {
	let o = start;
	x[o++] = logRatio(me.attack, me.baseAttack);
	x[o++] = logRatio(me.defense, me.baseDefense);
	x[o++] = logRatio(me.speed, me.baseSpeed);
	x[o++] = logRatio(opponent.attack, opponent.baseAttack);
	x[o++] = logRatio(opponent.defense, opponent.baseDefense);
	x[o++] = logRatio(opponent.speed, opponent.baseSpeed);
	x[o++] = Math.log(me.damageMultiplier);
	x[o++] = Math.log(opponent.damageMultiplier);
	x[o++] = logRatio(me.energy, opponent.attack);
	x[o++] = logRatio(opponent.energy, me.attack);
	x[o++] = me.hasNextAction ? 1 : 0;
	x[o++] = opponent.hasNextAction ? 1 : 0;
	x[o++] = me.breathRegen / 5;
	x[o++] = me.maxBreath / 25;
	x[o++] = opponent.breath / 25;
	setOneHot(x, o, indexes.classes.get(me.classId));
	return o + indexes.classes.size;
}

/**
 * Opponent's move counts, pets, role and style (third block)
 */
function writeContextFeatures(x: Float32Array, start: number, sides: {
	me: NeuralFighterView;
	opponent: NeuralFighterView;
}, context: {
	role: number;
	style: number;
	indexes: NeuralIndexes;
}): void {
	const {
		me, opponent
	} = sides;
	const { indexes } = context;
	let o = start;
	addHistoryCounts(x, o, opponent.historyIds, indexes);
	o += indexes.action.size;
	x[o++] = me.breath / 10;
	x[o++] = Math.min(1, me.historyIds.length / 20);
	const noPet = indexes.assistance.size;
	const assistanceOf = (fighter: NeuralFighterView): number => fighter.pet?.assistanceId ? indexes.assistance.get(fighter.pet.assistanceId) ?? noPet : noPet;
	x[o + assistanceOf(me)] = 1;
	o += noPet + 1;
	x[o + assistanceOf(opponent)] = 1;
	o += noPet + 1;
	x[o++] = me.pet?.attack ? logRatio(me.pet.attack, opponent.defense) : 0;
	x[o++] = me.pet?.speed ? logRatio(me.pet.speed, opponent.speed) : 0;
	x[o++] = opponent.pet?.attack ? logRatio(opponent.pet.attack, me.defense) : 0;
	x[o++] = opponent.pet?.speed ? logRatio(opponent.pet.speed, me.speed) : 0;
	x[o + context.role] = 1;
	o += 3;
	x[o + context.style] = 1;
}

/**
 * Inputs of the network for the fighter about to decide. Mirrors the training featurizer (solver/zfeatures.js)
 */
export function computeNeuralFeatures(sides: {
	me: NeuralFighterView;
	opponent: NeuralFighterView;
	turn: number;
}, context: {
	vocab: NeuralVocabulary;
	indexes: NeuralIndexes;
	role: NeuralRole;
	style: NeuralStyle;
}): Float32Array {
	const x = new Float32Array(getNeuralInputSize(context.vocab));
	const afterState = writeStateFeatures(x, sides.me, sides.opponent, sides.turn, context.indexes);
	const afterStats = writeStatFeatures(x, afterState, sides.me, sides.opponent, context.indexes);
	writeContextFeatures(x, afterStats, sides, {
		role: Math.max(0, context.vocab.roles.indexOf(context.role)),
		style: Math.max(0, context.vocab.styles.indexOf(context.style)),
		indexes: context.indexes
	});
	return x;
}
