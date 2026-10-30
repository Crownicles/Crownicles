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
import { getUnknownIdsOfModel } from "../../../../src/core/fights/kingGuards/neural/KingGuardNeuralAi";
import { ClassBehavior } from "../../../../src/core/fights/AiBehaviorController";
import { AiPlayerFighter } from "../../../../src/core/fights/fighter/AiPlayerFighter";
import { FightView } from "../../../../src/core/fights/FightView";
import { FightAction } from "../../../../src/data/FightAction";
import { CrowniclesLogger } from "../../../../../Lib/src/logs/CrowniclesLogger";

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
