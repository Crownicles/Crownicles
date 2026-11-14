import { PlantId } from "./PlantConstants";

export const QUEST_IDS = {
	EXPEDITION_TALISMANS: "expeditionTalismans",
	SEEDS: "seeds"
} as const;

export type QuestId = typeof QUEST_IDS[keyof typeof QUEST_IDS];

export abstract class QuestConstants {
	/**
	 * Ordered steps of each quest, in the order they are displayed.
	 * The progress of a quest is the number of its first steps completed: completing a step implies the previous ones are completed.
	 */
	static readonly STEPS = {
		[QUEST_IDS.EXPEDITION_TALISMANS]: [
			"meetVelanna",
			"anchorTalisman",
			"successfulExpedition",
			"cloneTalisman"
		],
		[QUEST_IDS.SEEDS]: [
			"commonHerb",
			"goldenClover",
			"lunarMoss",
			"ironRoot",
			"nightMushroom",
			"venomousLeaf",
			"fireBulb",
			"meatPlant",
			"crystalFlower",
			"ancientTree"
		]
	} as const satisfies Record<QuestId, readonly string[]>;

	/**
	 * Plant to plant in the garden to complete each step of the seeds quest
	 */
	static readonly SEEDS_STEP_PLANTS: Readonly<Record<typeof QuestConstants.STEPS[typeof QUEST_IDS.SEEDS][number], PlantId>> = {
		commonHerb: PlantId.COMMON_HERB,
		goldenClover: PlantId.GOLDEN_CLOVER,
		lunarMoss: PlantId.LUNAR_MOSS,
		ironRoot: PlantId.IRON_ROOT,
		nightMushroom: PlantId.NIGHT_MUSHROOM,
		venomousLeaf: PlantId.VENOMOUS_LEAF,
		fireBulb: PlantId.FIRE_BULB,
		meatPlant: PlantId.MEAT_PLANT,
		crystalFlower: PlantId.CRYSTAL_FLOWER,
		ancientTree: PlantId.ANCIENT_TREE
	};
}

export type QuestStepId<Q extends QuestId> = typeof QuestConstants.STEPS[Q][number];
