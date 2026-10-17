import { ClassConstants } from "./ClassConstants";

export abstract class ClassInfoConstants {
	static readonly HOLY_CLASSES = [
		ClassConstants.CLASSES_ID.PIKEMAN,
		ClassConstants.CLASSES_ID.KNIGHT,
		ClassConstants.CLASSES_ID.PALADIN,
		ClassConstants.CLASSES_ID.VALIANT_KNIGHT,
		ClassConstants.CLASSES_ID.LUMINOUS_PALADIN
	];

	static CLASSES_WITH_BONUS_ACTION =
		[
			ClassConstants.CLASSES_ID.POWERFUL_INFANTRYMAN,
			ClassConstants.CLASSES_ID.INFANTRYMAN
		];

	static readonly STEALTHY_CLASSES = [
		ClassConstants.CLASSES_ID.ROCK_THROWER,
		ClassConstants.CLASSES_ID.SLINGER,
		ClassConstants.CLASSES_ID.ARCHER,
		ClassConstants.CLASSES_ID.GUNNER,
		ClassConstants.CLASSES_ID.FORMIDABLE_GUNNER,
		ClassConstants.CLASSES_ID.VETERAN,
		ClassConstants.CLASSES_ID.EXPERIENCED_VETERAN
	];

	static readonly GUNNER_CLASSES = [
		ClassConstants.CLASSES_ID.GUNNER,
		ClassConstants.CLASSES_ID.FORMIDABLE_GUNNER
	];

	static readonly CLASS_LINEAGES = {
		infantryman: [
			ClassConstants.CLASSES_ID.RECRUIT,
			ClassConstants.CLASSES_ID.FIGHTER,
			ClassConstants.CLASSES_ID.SOLDIER,
			ClassConstants.CLASSES_ID.INFANTRYMAN,
			ClassConstants.CLASSES_ID.POWERFUL_INFANTRYMAN
		],
		tank: [
			ClassConstants.CLASSES_ID.GLOVED,
			ClassConstants.CLASSES_ID.HELMETED,
			ClassConstants.CLASSES_ID.ENMESHED,
			ClassConstants.CLASSES_ID.TANK,
			ClassConstants.CLASSES_ID.IMPENETRABLE_TANK
		],
		gunner: [
			ClassConstants.CLASSES_ID.ROCK_THROWER,
			ClassConstants.CLASSES_ID.SLINGER,
			ClassConstants.CLASSES_ID.ARCHER,
			ClassConstants.CLASSES_ID.GUNNER,
			ClassConstants.CLASSES_ID.FORMIDABLE_GUNNER
		],
		knight: [
			ClassConstants.CLASSES_ID.ESQUIRE,
			ClassConstants.CLASSES_ID.HORSE_RIDER,
			ClassConstants.CLASSES_ID.PIKEMAN,
			ClassConstants.CLASSES_ID.KNIGHT,
			ClassConstants.CLASSES_ID.VALIANT_KNIGHT
		],
		paladin: [
			ClassConstants.CLASSES_ID.PALADIN,
			ClassConstants.CLASSES_ID.LUMINOUS_PALADIN
		],
		veteran: [
			ClassConstants.CLASSES_ID.VETERAN,
			ClassConstants.CLASSES_ID.EXPERIENCED_VETERAN
		],
		mage: [ClassConstants.CLASSES_ID.MYSTIC_MAGE]
	} as const;

	static getClassLineageName(classId: number): keyof typeof ClassInfoConstants.CLASS_LINEAGES | null {
		const classLineages = Object.entries(this.CLASS_LINEAGES) as [
			keyof typeof ClassInfoConstants.CLASS_LINEAGES,
			readonly number[]
		][];
		return classLineages.find(([, lineage]) => lineage.includes(classId))?.[0] ?? null;
	}

	static getClassLineage(classId: number): readonly number[] {
		const lineageName = this.getClassLineageName(classId);
		return lineageName ? this.CLASS_LINEAGES[lineageName] : [classId];
	}

	static readonly MENU_IDS = {
		CLASS_SELECTION: "classSelectionMenu",
		LIST_OPTION: "listOption"
	};
}
