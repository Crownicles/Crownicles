import { FightView } from "./FightView";
import { FightAction } from "../../data/FightAction";
import { AiPlayerFighter } from "./fighter/AiPlayerFighter";
import { ClassConstants } from "../../../../Lib/src/constants/ClassConstants";
import KnightFightBehavior from "./aiClassBehaviors/KnightFightBehavior";
import HorseRiderFightBehavior from "./aiClassBehaviors/HorseRiderFightBehavior";
import EsquireFightBehavior from "./aiClassBehaviors/EsquireFightBehavior";
import MysticMageFightBehavior from "./aiClassBehaviors/MysticMageFightBehavior";
import GunnerFightBehavior from "./aiClassBehaviors/GunnerFightBehavior";
import InfantryManFightBehavior from "./aiClassBehaviors/InfantrymanFightBehavior";
import FighterFightBehavior from "./aiClassBehaviors/FighterFightBehavior";
import RecruitFightBehavior from "./aiClassBehaviors/RecruitFightBehavior";
import RockThrowerFightBehavior from "./aiClassBehaviors/RockThrowerFightBehavior";
import SlingerFightBehavior from "./aiClassBehaviors/SlingerFightBehavior";
import VeteranFightBehavior from "./aiClassBehaviors/VeteranFightBehavior";
import PaladinFightBehavior from "./aiClassBehaviors/PaladinFightBehavior";
import TankFightBehavior from "./aiClassBehaviors/TankFightBehavior";
import HelmetedFightBehavior from "./aiClassBehaviors/HelmetedFightBehavior";
import GlovedFightBehavior from "./aiClassBehaviors/GlovedFightBehavior";

export interface ClassBehavior {
	chooseAction(fighter: AiPlayerFighter, fightView: FightView): FightAction;
}

// Type for behavior constructor
type ClassBehaviorConstructor = new () => ClassBehavior;

// Map to store class behavior constructors by class ID
const classBehaviorConstructors = new Map<number, ClassBehaviorConstructor>();

/**
 * Initialize all class behaviors in a map so they can be accessed by class ID
 */
export function initializeAllClassBehaviors(): void {
	registerClassBehavior(ClassConstants.CLASSES_ID.KNIGHT, KnightFightBehavior);
	registerClassBehavior(ClassConstants.CLASSES_ID.VALIANT_KNIGHT, KnightFightBehavior);
	registerClassBehavior(ClassConstants.CLASSES_ID.PIKEMAN, KnightFightBehavior);
	registerClassBehavior(ClassConstants.CLASSES_ID.HORSE_RIDER, HorseRiderFightBehavior);
	registerClassBehavior(ClassConstants.CLASSES_ID.ESQUIRE, EsquireFightBehavior);
	registerClassBehavior(ClassConstants.CLASSES_ID.MYSTIC_MAGE, MysticMageFightBehavior);
	registerClassBehavior(ClassConstants.CLASSES_ID.FORMIDABLE_GUNNER, GunnerFightBehavior);
	registerClassBehavior(ClassConstants.CLASSES_ID.GUNNER, GunnerFightBehavior);
	registerClassBehavior(ClassConstants.CLASSES_ID.ARCHER, GunnerFightBehavior);
	registerClassBehavior(ClassConstants.CLASSES_ID.SLINGER, SlingerFightBehavior);
	registerClassBehavior(ClassConstants.CLASSES_ID.ROCK_THROWER, RockThrowerFightBehavior);
	registerClassBehavior(ClassConstants.CLASSES_ID.POWERFUL_INFANTRYMAN, InfantryManFightBehavior);
	registerClassBehavior(ClassConstants.CLASSES_ID.INFANTRYMAN, InfantryManFightBehavior);
	registerClassBehavior(ClassConstants.CLASSES_ID.SOLDIER, InfantryManFightBehavior);
	registerClassBehavior(ClassConstants.CLASSES_ID.FIGHTER, FighterFightBehavior);
	registerClassBehavior(ClassConstants.CLASSES_ID.RECRUIT, RecruitFightBehavior);
	registerClassBehavior(ClassConstants.CLASSES_ID.VETERAN, VeteranFightBehavior);
	registerClassBehavior(ClassConstants.CLASSES_ID.EXPERIENCED_VETERAN, VeteranFightBehavior);
	registerClassBehavior(ClassConstants.CLASSES_ID.PALADIN, PaladinFightBehavior);
	registerClassBehavior(ClassConstants.CLASSES_ID.LUMINOUS_PALADIN, PaladinFightBehavior);
	registerClassBehavior(ClassConstants.CLASSES_ID.TANK, TankFightBehavior);
	registerClassBehavior(ClassConstants.CLASSES_ID.IMPENETRABLE_TANK, TankFightBehavior);
	registerClassBehavior(ClassConstants.CLASSES_ID.ENMESHED, TankFightBehavior);
	registerClassBehavior(ClassConstants.CLASSES_ID.HELMETED, HelmetedFightBehavior);
	registerClassBehavior(ClassConstants.CLASSES_ID.GLOVED, GlovedFightBehavior);
}

/**
 * Register a class behavior constructor
 * @param classId The class ID
 * @param behaviorConstructor The behavior constructor
 */
export function registerClassBehavior(classId: number, behaviorConstructor: ClassBehaviorConstructor): void {
	classBehaviorConstructors.set(classId, behaviorConstructor);
}

/**
 * Get a new instance of class behavior by class ID
 * @param classId The class ID
 * @returns A new instance of the class behavior or undefined if not found
 */
export function getAiClassBehavior(classId: number): ClassBehavior | undefined {
	return classBehaviorConstructors.get(classId)
		? new (classBehaviorConstructors.get(classId)!)()
		: undefined;
}
