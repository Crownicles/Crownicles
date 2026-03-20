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
		ClassConstants.CLASSES_ID.EXPERIENCED_VETERAN
	];

	static readonly GUNNER_CLASSES = [
		ClassConstants.CLASSES_ID.GUNNER,
		ClassConstants.CLASSES_ID.FORMIDABLE_GUNNER
	];

	static readonly MENU_IDS = {
		CLASS_SELECTION: "classSelectionMenu",
		LIST_OPTION: "listOption"
	};
}
