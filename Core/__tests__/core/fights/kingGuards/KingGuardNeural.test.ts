import {
	describe, expect, it, vi
} from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
	buildNeuralIndexes, computeNeuralFeatures, getNeuralInputSize, NeuralFighterView
} from "../../../../src/core/fights/kingGuards/neural/KingGuardNeuralFeatures";
import {
	KingGuardNeuralModel, NeuralModelFile
} from "../../../../src/core/fights/kingGuards/neural/KingGuardNeuralModel";
import { KingGuardNeuralBehavior } from "../../../../src/core/fights/kingGuards/neural/KingGuardNeuralBehavior";
import {
	createKingGuardBehavior, getUnknownIdsOfModel, resetKingGuardModel
} from "../../../../src/core/fights/kingGuards/neural/KingGuardNeuralAi";
import {
	ClassBehavior, initializeAllClassBehaviors
} from "../../../../src/core/fights/AiBehaviorController";
import { AiPlayerFighter } from "../../../../src/core/fights/fighter/AiPlayerFighter";
import { FightView } from "../../../../src/core/fights/FightView";
import { FightAction } from "../../../../src/data/FightAction";
import { CrowniclesLogger } from "../../../../../Lib/src/logs/CrowniclesLogger";
import { ClassConstants } from "../../../../../Lib/src/constants/ClassConstants";

type FixtureState = {
	me: NeuralFighterView;
	opponent: NeuralFighterView;
	turn: number;
	features: number[];
	scores: number[];
};

// Written by the training tools (solver/genFixture.js): decision states of simulated fights, the features the
// training computed for them, a small random model and the scores the training's inference gives
const fixture = JSON.parse(readFileSync(join(__dirname, "kingGuardNeuralFixture.json"), "utf8")) as {
	model: NeuralModelFile;
	states: FixtureState[];
};
const model = new KingGuardNeuralModel(fixture.model);
const indexes = buildNeuralIndexes(fixture.model.vocab);

function featuresOf(state: FixtureState): Float32Array {
	return computeNeuralFeatures({
		me: state.me, opponent: state.opponent, turn: state.turn
	}, {
		vocab: fixture.model.vocab, indexes, role: "guard", style: "strategist"
	});
}

function fakeAction(id: string, breath: number): FightAction {
	return {
		id, breath
	} as FightAction;
}

/**
 * Fighter of a class with plain stats, read by the network like a real one
 * @param classId
 */
function fighterOfClass(classId: number): AiPlayerFighter {
	return Object.assign(Object.create(AiPlayerFighter.prototype) as AiPlayerFighter, {
		level: 120,
		player: { class: classId },
		alteration: null,
		fightActionsHistory: [],
		nextFightAction: null,
		availableFightActions: new Map([["simpleAttack", fakeAction("simpleAttack", 0)], ["heavyAttack", fakeAction("heavyAttack", 0)]]),
		getBaseStats: () => ({
			attack: 500, defense: 500, speed: 300
		}),
		getEnergy: (): number => 1500,
		getMaxEnergy: (): number => 2000,
		getBreath: (): number => 10,
		getMaxBreath: (): number => 16,
		getRegenBreath: (): number => 3,
		getAttack: (): number => 500,
		getDefense: (): number => 500,
		getSpeed: (): number => 300,
		getDamageMultiplier: (): number => 1
	});
}

/**
 * Play one decision of a guard of a class against an opponent of a class, with a scripted fallback that plays a simple attack
 * @param guardClassId
 * @param opponentClassId
 */
function decide(guardClassId: number, opponentClassId: number): ClassBehavior {
	const fallback: ClassBehavior = { chooseAction: vi.fn().mockReturnValue(fakeAction("simpleAttack", 0)) };
	const fightView = {
		fightController: {
			turn: 5,
			getDefendingFighter: (): AiPlayerFighter => fighterOfClass(opponentClassId)
		}
	} as unknown as FightView;
	new KingGuardNeuralBehavior(model, fallback).chooseAction(fighterOfClass(guardClassId), fightView);
	return fallback;
}

describe("King guard network", () => {
	it("has as many inputs as the trained model", () => {
		expect(getNeuralInputSize(fixture.model.vocab)).toBe(fixture.model.F);
	});

	it("computes the same features as the training", () => {
		for (const state of fixture.states) {
			const features = featuresOf(state);
			state.features.forEach((expected, i) => expect(features[i]).toBeCloseTo(expected, 4));
		}
	});

	it("scores the moves like the training's inference", () => {
		for (const state of fixture.states) {
			const scores = model.scores(featuresOf(state));
			state.scores.forEach((expected, i) => expect(scores[i]).toBeCloseTo(expected, 3));
		}
	});

	it("knows every action, alteration and pet assistance of the game", () => {
		expect(getUnknownIdsOfModel(model)).toEqual([]);
	});

	it("reports the ids a model does not know", () => {
		const outdated = new KingGuardNeuralModel({
			...fixture.model,
			vocab: {
				...fixture.model.vocab,
				assistIds: fixture.model.vocab.assistIds.slice(1)
			}
		});
		expect(getUnknownIdsOfModel(outdated)).toEqual([fixture.model.vocab.assistIds[0]]);
	});

	it("does not use a model that cannot read a bleeding fighter or the second half of a charged attack", () => {
		const outdated = new KingGuardNeuralModel({
			...fixture.model,
			vocab: {
				...fixture.model.vocab,
				// Same number of actions as the weights: the two actions are replaced by ids the game does not have
				actionIds: fixture.model.vocab.actionIds.map(id => (id === "chargingAttack" || id === "ultimateAttack" ? `unknown_${id}` : id)),
				alterationIds: fixture.model.vocab.alterationIds.filter(id => id !== "bleeding")
			}
		});
		expect(getUnknownIdsOfModel(outdated)).toEqual(expect.arrayContaining(["chargingAttack", "ultimateAttack", "bleeding"]));
	});

	it("does not use a model trained before the pets had a second power", () => {
		const { secondaryIds, ...vocab } = fixture.model.vocab;
		const outdated = new KingGuardNeuralModel({
			...fixture.model,
			vocab
		});
		expect(getUnknownIdsOfModel(outdated)).toEqual(expect.arrayContaining(secondaryIds!));
	});

	it("lets the scripted behavior decide against an opponent of a class the model was not trained on", () => {
		expect(decide(ClassConstants.CLASSES_ID.VALIANT_KNIGHT, ClassConstants.CLASSES_ID.POWERFUL_INFANTRYMAN).chooseAction).not.toHaveBeenCalled();
		expect(decide(ClassConstants.CLASSES_ID.VALIANT_KNIGHT, ClassConstants.CLASSES_ID.KNIGHT).chooseAction).toHaveBeenCalledOnce();
		expect(decide(ClassConstants.CLASSES_ID.KNIGHT, ClassConstants.CLASSES_ID.POWERFUL_INFANTRYMAN).chooseAction).toHaveBeenCalledOnce();
	});

	it("gives a guard of a class the model was not trained on its scripted behavior", () => {
		initializeAllClassBehaviors();
		resetKingGuardModel();

		expect(createKingGuardBehavior(ClassConstants.CLASSES_ID.VALIANT_KNIGHT)).toBeInstanceOf(KingGuardNeuralBehavior);
		expect(createKingGuardBehavior(ClassConstants.CLASSES_ID.KNIGHT)).not.toBeInstanceOf(KingGuardNeuralBehavior);
	});

	it("hands the decision to the scripted behavior when the network fails", () => {
		const logError = vi.spyOn(CrowniclesLogger, "errorWithObj").mockImplementation(() => undefined);
		const fallbackAction = fakeAction("simpleAttack", 0);
		const fallback: ClassBehavior = { chooseAction: vi.fn().mockReturnValue(fallbackAction) };
		const behavior = new KingGuardNeuralBehavior(model, fallback);
		const fighter = {
			availableFightActions: new Map([["simpleAttack", fallbackAction], ["heavyAttack", fakeAction("heavyAttack", 0)]]),
			getBreath: (): number => 10
		} as unknown as AiPlayerFighter;
		const fightView = {
			fightController: {
				getDefendingFighter: (): never => {
					throw new Error("no opponent");
				}
			}
		} as unknown as FightView;
		expect(behavior.chooseAction(fighter, fightView)).toBe(fallbackAction);
		expect(fallback.chooseAction).toHaveBeenCalledOnce();
		expect(logError).toHaveBeenCalledOnce();
	});
});
