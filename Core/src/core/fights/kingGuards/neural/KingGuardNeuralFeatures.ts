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
 * The fighter about to decide, its opponent and the turn of the fight
 */
export type NeuralSides = {
	me: NeuralFighterView;
	opponent: NeuralFighterView;
	turn: number;
};

/**
 * Indexes of every vocabulary of the model
 */
export type NeuralIndexes = {
	action: Map<string, number>;
	alteration: Map<string, number>;
	assistance: Map<string, number>;
	classes: Map<number, number>;
};

/**
 * Position of every id of the model's vocabulary in its inputs
 * @param vocab The vocabulary of the model
 */
export function buildNeuralIndexes(vocab: NeuralVocabulary): NeuralIndexes {
	return {
		action: new Map(vocab.actionIds.map((id, i) => [id, i])),
		alteration: new Map(vocab.alterationIds.map((id, i) => [id, i])),
		assistance: new Map(vocab.assistIds.map((id, i) => [id, i])),
		classes: new Map(vocab.classes.map((id, i) => [id, i]))
	};
}

const STATE_SCALARS = 11;
const STAT_SCALARS = 15;
const PET_SCALARS = 4;

/**
 * Number of inputs of a model with this vocabulary
 * @param vocab The vocabulary of the model
 */
export function getNeuralInputSize(vocab: NeuralVocabulary): number {
	const actions = vocab.actionIds.length;
	const alterations = vocab.alterationIds.length;
	const classes = vocab.classes.length;
	const assistances = vocab.assistIds.length + 1;
	return STATE_SCALARS + 2 * alterations + 3 * actions + classes + 1
		+ STAT_SCALARS + classes
		+ actions + 2
		+ 2 * assistances + PET_SCALARS + vocab.roles.length + vocab.styles.length;
}

/**
 * Log of a ratio of two stats, both floored to 1 (state features)
 * @param numerator
 * @param denominator
 */
function ratio(numerator: number, denominator: number): number {
	return Math.log(Math.max(1, numerator) / Math.max(1, denominator));
}

/**
 * Log of a ratio of two non-negative quantities shifted by one (stat changes, races, pets)
 * @param numerator
 * @param denominator
 */
function logRatio(numerator: number, denominator: number): number {
	return Math.log((Math.max(0, numerator) + 1) / (Math.max(0, denominator) + 1));
}

/**
 * Writes the inputs one block after the other
 */
class FeatureWriter {
	public readonly values: Float32Array;

	private position = 0;

	public constructor(size: number) {
		this.values = new Float32Array(size);
	}

	/**
	 * Writes the next input
	 * @param value
	 */
	public push(value: number): void {
		this.values[this.position] = value;
		this.position++;
	}

	/**
	 * Writes a block of `size` inputs where only the one at `index` is set (none when the index is unknown)
	 * @param size
	 * @param index
	 */
	public oneHot(size: number, index: number | undefined): void {
		if (index !== undefined) {
			this.values[this.position + index] = 1;
		}
		this.position += size;
	}

	/**
	 * Writes a block with one input per action, growing by 0.2 (up to 1) with each use of the action
	 * @param indexes
	 * @param historyIds
	 */
	public actionCounts(indexes: NeuralIndexes, historyIds: string[]): void {
		for (const id of historyIds) {
			const index = indexes.action.get(id);
			if (index !== undefined) {
				const cell = this.position + index;
				this.values[cell] = Math.min(1, this.values[cell] + 0.2);
			}
		}
		this.position += indexes.action.size;
	}
}

/**
 * Index of the last action of a fighter in the vocabulary
 * @param fighter
 * @param indexes
 */
function lastActionIndex(fighter: NeuralFighterView, indexes: NeuralIndexes): number | undefined {
	return fighter.historyIds.length > 0 ? indexes.action.get(fighter.historyIds[fighter.historyIds.length - 1]) : undefined;
}

/**
 * Number of god moves in an action history
 * @param historyIds
 */
function countGodMoves(historyIds: string[]): number {
	return historyIds.filter(id => FightConstants.GOD_MOVES.includes(id)).length;
}

/**
 * Index of an alteration in the vocabulary
 * @param alterationId
 * @param indexes
 */
function alterationIndex(alterationId: string | null, indexes: NeuralIndexes): number | undefined {
	return alterationId ? indexes.alteration.get(alterationId) : undefined;
}

/**
 * Energy, breath, turn and stat ratios of both fighters
 * @param writer
 * @param sides
 */
function writeStateScalars(writer: FeatureWriter, sides: NeuralSides): void {
	const {
		me, opponent, turn
	} = sides;
	const myEnergy = me.energy / me.maxEnergy;
	const opponentEnergy = opponent.energy / opponent.maxEnergy;
	writer.push(1);
	writer.push(myEnergy);
	writer.push(opponentEnergy);
	writer.push(myEnergy - opponentEnergy);
	writer.push(me.breath / me.maxBreath);
	writer.push(me.breath / 16);
	writer.push(opponent.breath / opponent.maxBreath);
	writer.push(turn / FightConstants.MAX_TURNS);
	writer.push(ratio(me.speed, opponent.speed));
	writer.push(ratio(me.attack, opponent.defense));
	writer.push(ratio(opponent.attack, me.defense));
}

/**
 * Alterations, last moves, move counts and the opponent's class (first block, shared with the earlier models)
 * @param writer
 * @param sides
 * @param indexes
 */
function writeStateFeatures(writer: FeatureWriter, sides: NeuralSides, indexes: NeuralIndexes): void {
	const {
		me, opponent
	} = sides;
	writeStateScalars(writer, sides);
	writer.oneHot(indexes.alteration.size, alterationIndex(me.alterationId, indexes));
	writer.oneHot(indexes.alteration.size, alterationIndex(opponent.alterationId, indexes));
	writer.oneHot(indexes.action.size, lastActionIndex(me, indexes));
	writer.oneHot(indexes.action.size, lastActionIndex(opponent, indexes));
	writer.actionCounts(indexes, me.historyIds);
	writer.oneHot(indexes.classes.size, indexes.classes.get(opponent.classId));
	writer.push((countGodMoves(me.historyIds) + countGodMoves(opponent.historyIds)) / 2);
}

/**
 * Stat changes, damage multipliers, energy races, follow-up moves, breath and the fighter's class (second block)
 * @param writer
 * @param sides
 * @param indexes
 */
function writeStatFeatures(writer: FeatureWriter, sides: NeuralSides, indexes: NeuralIndexes): void {
	const {
		me, opponent
	} = sides;
	writer.push(logRatio(me.attack, me.baseAttack));
	writer.push(logRatio(me.defense, me.baseDefense));
	writer.push(logRatio(me.speed, me.baseSpeed));
	writer.push(logRatio(opponent.attack, opponent.baseAttack));
	writer.push(logRatio(opponent.defense, opponent.baseDefense));
	writer.push(logRatio(opponent.speed, opponent.baseSpeed));
	writer.push(Math.log(me.damageMultiplier));
	writer.push(Math.log(opponent.damageMultiplier));
	writer.push(logRatio(me.energy, opponent.attack));
	writer.push(logRatio(opponent.energy, me.attack));
	writer.push(me.hasNextAction ? 1 : 0);
	writer.push(opponent.hasNextAction ? 1 : 0);
	writer.push(me.breathRegen / 5);
	writer.push(me.maxBreath / 25);
	writer.push(opponent.breath / 25);
	writer.oneHot(indexes.classes.size, indexes.classes.get(me.classId));
}

/**
 * Index of the assistance of a fighter's pet, or the "no pet" slot
 * @param fighter
 * @param indexes
 */
function assistanceIndex(fighter: NeuralFighterView, indexes: NeuralIndexes): number {
	const noPet = indexes.assistance.size;
	const assistanceId = fighter.pet?.assistanceId;
	return assistanceId ? indexes.assistance.get(assistanceId) ?? noPet : noPet;
}

/**
 * Strength of a pet against what it hits: its attack against the target's defense, its speed against the target's
 * @param writer
 * @param pet
 * @param target
 */
function writePetStrength(writer: FeatureWriter, pet: NeuralFighterView["pet"], target: NeuralFighterView): void {
	writer.push(pet?.attack ? logRatio(pet.attack, target.defense) : 0);
	writer.push(pet?.speed ? logRatio(pet.speed, target.speed) : 0);
}

/**
 * Opponent's move counts, breath, both pets (third block)
 * @param writer
 * @param sides
 * @param indexes
 */
function writePetFeatures(writer: FeatureWriter, sides: NeuralSides, indexes: NeuralIndexes): void {
	const {
		me, opponent
	} = sides;
	writer.actionCounts(indexes, opponent.historyIds);
	writer.push(me.breath / 10);
	writer.push(Math.min(1, me.historyIds.length / 20));
	writer.oneHot(indexes.assistance.size + 1, assistanceIndex(me, indexes));
	writer.oneHot(indexes.assistance.size + 1, assistanceIndex(opponent, indexes));
	writePetStrength(writer, me.pet, opponent);
	writePetStrength(writer, opponent.pet, me);
}

/**
 * Inputs of the network for the fighter about to decide. Mirrors the training featurizer (solver/zfeatures.js)
 * @param sides The fighter about to decide, its opponent and the turn
 * @param context The model's vocabulary and indexes, the role and the style of the fighter
 */
export function computeNeuralFeatures(sides: NeuralSides, context: {
	vocab: NeuralVocabulary;
	indexes: NeuralIndexes;
	role: NeuralRole;
	style: NeuralStyle;
}): Float32Array {
	const { vocab } = context;
	const writer = new FeatureWriter(getNeuralInputSize(vocab));
	writeStateFeatures(writer, sides, context.indexes);
	writeStatFeatures(writer, sides, context.indexes);
	writePetFeatures(writer, sides, context.indexes);
	writer.oneHot(vocab.roles.length, Math.max(0, vocab.roles.indexOf(context.role)));
	writer.oneHot(vocab.styles.length, Math.max(0, vocab.styles.indexOf(context.style)));
	return writer.values;
}
