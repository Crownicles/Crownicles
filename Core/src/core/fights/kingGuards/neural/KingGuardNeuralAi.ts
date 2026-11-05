import { existsSync } from "fs";
import {
	ClassBehavior, getAiClassBehavior
} from "../../AiBehaviorController";
import { ClassDataController } from "../../../../data/Class";
import { PetConstants } from "../../../../../../Lib/src/constants/PetConstants";
import { FightConstants } from "../../../../../../Lib/src/constants/FightConstants";
import { RandomUtils } from "../../../../../../Lib/src/utils/RandomUtils";
import { CrowniclesLogger } from "../../../../../../Lib/src/logs/CrowniclesLogger";
import { KingGuardNeuralModel } from "./KingGuardNeuralModel";
import { KingGuardNeuralBehavior } from "./KingGuardNeuralBehavior";
import { FightAlterations } from "../../actions/FightAlterations";

// undefined: not loaded yet; null: missing or unusable, the guards keep their scripted behaviors
let model: KingGuardNeuralModel | null | undefined;

/**
 * Ids of the game the model does not know: a game update added an action, an alteration or a pet assistance
 * after the training, and the network would misread the fight. Every player action is checked, the second half of
 * a charged attack included, since any of them can be the last action of a fighter, and every alteration of the game
 * @param candidate The model to check
 */
export function getUnknownIdsOfModel(candidate: KingGuardNeuralModel): string[] {
	const known = new Set([
		...candidate.vocab.actionIds,
		...candidate.vocab.alterationIds,
		...candidate.vocab.assistIds,
		...candidate.vocab.secondaryIds ?? []
	]);
	const gameIds = [
		...candidate.vocab.classes.flatMap(classId => ClassDataController.instance.getById(classId)?.fightActionsIds ?? []),
		...Object.values(FightConstants.FIGHT_ACTIONS.PLAYER),
		...Object.values(FightConstants.FIGHT_ACTIONS.ALTERATION),
		...Object.values(FightAlterations),
		...[...PetConstants.PET_BEHAVIORS, ...PetConstants.PET_SECONDARY_BEHAVIORS].map(mapping => mapping.behaviorId)
	];
	return [...new Set(gameIds.filter(id => !known.has(id)))];
}

/**
 * The model of the resources, or null when it is missing, unreadable or outdated
 */
function loadModel(): KingGuardNeuralModel | null {
	const path = FightConstants.KING_GUARD.NEURAL_AI.MODEL_PATH;
	if (!existsSync(path)) {
		CrowniclesLogger.warn(`No king guard model at ${path}, the guards use their scripted behaviors`);
		return null;
	}
	try {
		const loaded = KingGuardNeuralModel.fromFile(path);
		const unknownIds = getUnknownIdsOfModel(loaded);
		if (unknownIds.length > 0) {
			CrowniclesLogger.warn(`The king guard model does not know ${unknownIds.join(", ")}: the guards use their scripted behaviors until it is retrained`);
			return null;
		}
		return loaded;
	}
	catch (error) {
		CrowniclesLogger.errorWithObj("Failed to load the king guard model, the guards use their scripted behaviors", error);
		return null;
	}
}

/**
 * Behavior of a new king guard: the policy network (a share of the guards, see NEURAL_AI.PROBABILITY), with the
 * scripted behavior of its class as a fallback. The guards of a class the model was not trained on keep their scripted behavior
 * @param classId The class of the guard
 */
export function createKingGuardBehavior(classId: number): ClassBehavior | undefined {
	const scripted = getAiClassBehavior(classId);
	if (!RandomUtils.crowniclesRandom.bool(FightConstants.KING_GUARD.NEURAL_AI.PROBABILITY)) {
		return scripted;
	}
	if (model === undefined) {
		model = loadModel();
	}
	return model?.vocab.classes.includes(classId) ? new KingGuardNeuralBehavior(model, scripted) : scripted;
}

/**
 * Forget the loaded model (tests)
 */
export function resetKingGuardModel(): void {
	model = undefined;
}
