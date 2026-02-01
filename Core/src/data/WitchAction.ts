import { DataControllerString } from "./DataController";
import { Data } from "./Data";
import { readdirSync } from "fs";
import { RandomUtils } from "../../../Lib/src/utils/RandomUtils";
import Player from "../core/database/game/models/Player";
import { SmallEventConstants } from "../../../Lib/src/constants/SmallEventConstants";
import { CrowniclesPacket } from "../../../Lib/src/packets/CrowniclesPacket";
import { TravelTime } from "../core/maps/TravelTime";
import { NumberChangeReason } from "../../../Lib/src/constants/LogsConstants";
import { Effect } from "../../../Lib/src/types/Effect";
import { WitchActionOutcomeType } from "../../../Lib/src/types/WitchActionOutcomeType";
import { GenerateRandomItemOptions } from "../core/utils/ItemUtils";

/**
 * Base class for all witch actions
 */
export class WitchAction extends Data<string> {
	public readonly isIngredient!: boolean;

	public readonly forceEffect!: boolean;

	public readonly effectName!: string;

	public readonly timePenalty!: number;

	private outcomeProbabilities!: OutcomeProbabilities;

	/**
	 * Use the function stored in the witchAction ts file to generate the potion following specific characteristics
	 */
	public generatePotionWitchAction(): GenerateRandomItemOptions | null {
		const withActionFunctions = WitchActionDataController.getWitchActionFunction(this.id);
		return withActionFunctions?.generatePotion ? withActionFunctions.generatePotion() : null;
	}

	public async checkMissionsWitchAction(player: Player, outcome: WitchActionOutcomeType, response: CrowniclesPacket[]): Promise<void> {
		const withActionFunctions = WitchActionDataController.getWitchActionFunction(this.id);
		if (withActionFunctions?.checkMissions) {
			await withActionFunctions.checkMissions(player, outcome, response, this.tags ?? []);
		}
	}

	public async giveEffect(player: Player): Promise<void> {
		await TravelTime.applyEffect(
			player,
			this.getEffectType(),
			this.timePenalty,
			new Date(),
			NumberChangeReason.SMALL_EVENT
		);
	}

	/**
	 * Generate a random outcome based on the defined probabilities of the witch action
	 */
	public generateOutcome(): WitchActionOutcomeType {
		// Get total probability weight
		const totalProbability = Object.values(this.outcomeProbabilities)
			.reduce((sum, prob) => sum + prob, 0);

		// Generate a random number between 0 and total probability
		const random = RandomUtils.randInt(0, totalProbability);

		// Track cumulative probability as we check each outcome
		let cumulativeProbability = 0;

		// Check each outcome type
		for (const [outcomeKey, probability] of Object.entries(this.outcomeProbabilities)) {
			cumulativeProbability += probability;

			if (random <= cumulativeProbability) {
				return WitchActionOutcomeType[outcomeKey.toUpperCase() as keyof typeof WitchActionOutcomeType];
			}
		}

		// Fallback to the first outcome if nothing matched (shouldn't happen)
		return WitchActionOutcomeType[Object.keys(WitchActionOutcomeType)[0] as keyof typeof WitchActionOutcomeType];
	}

	public checkOutcomeProbabilities(): void {
		if (Object.values(this.outcomeProbabilities)
			.reduce((sumProbability, probability) => sumProbability + probability) !== SmallEventConstants.WITCH.MAX_PROBABILITY) {
			throw new Error(`The sum of the probabilities must be 50 for the witch event ${this.id}`);
		}
	}

	private getEffectType(): Effect {
		return Effect.getById(this.effectName) ?? Effect.OCCUPIED;
	}
}

type OutcomeProbabilities = {
	[key in keyof WitchActionOutcomeType]?: number;
};

export type WitchActionFuncs = {
	checkMissions?: CheckMissionsLike;
	generatePotion?: GeneratePotionLike;
};

export type CheckMissionsLike = (player: Player, outcome: WitchActionOutcomeType, response: CrowniclesPacket[], tags: string[]) => void | Promise<void>;
export type GeneratePotionLike = () => GenerateRandomItemOptions;

export class WitchActionDataController extends DataControllerString<WitchAction> {
	static readonly instance = new WitchActionDataController("witch");

	private static witchActionsFunctionsCache: Map<string, WitchActionFuncs>;

	/**
	 * Load the witch action functions from the folder witch these functions describe potion characteristics and missions
	 * @param id
	 */
	public static getWitchActionFunction(id: string): WitchActionFuncs {
		if (!WitchActionDataController.witchActionsFunctionsCache) {
			WitchActionDataController.witchActionsFunctionsCache = new Map<string, WitchActionFuncs>();
			WitchActionDataController.loadWitchActionsFromFolder("dist/Core/src/core/smallEvents/witch", "../core/smallEvents/witch");
			WitchActionDataController.instance.getValuesArray()
				.forEach(witchAction => {
					witchAction.checkOutcomeProbabilities();
				});
		}
		return WitchActionDataController.witchActionsFunctionsCache.get(id) ?? {};
	}

	private static loadWitchActionsFromFolder(path: string, relativePath: string): void {
		const files = readdirSync(path);
		for (const file of files) {
			if (file.endsWith(".js")) {
				const defaultFunc = require(`${relativePath}/${file.substring(0, file.length - 3)}`).witchSmallEvent;
				const fightActionName = file.substring(0, file.length - 3);
				WitchActionDataController.witchActionsFunctionsCache.set(fightActionName, defaultFunc);
			}
		}
	}

	public getRandomWitchAction(excludedWitchActions: WitchAction[]): WitchAction {
		return RandomUtils.crowniclesRandom.pick(Array.from(this.data.values())
			.filter(witchAction => !excludedWitchActions.includes(witchAction)));
	}

	newInstance(): WitchAction {
		return new WitchAction();
	}

	getRandomWitchEventByType(isIngredient: boolean): WitchAction {
		return RandomUtils.crowniclesRandom.pick(Array.from(this.data.values())
			.filter(witchAction => witchAction.isIngredient === isIngredient));
	}

	getDoNothing(): WitchAction {
		return this.getById("nothing")!;
	}

	getAll(): WitchAction[] {
		return Array.from(this.data.values());
	}
}
