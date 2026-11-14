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
}

export type QuestStepId<Q extends QuestId> = typeof QuestConstants.STEPS[Q][number];
