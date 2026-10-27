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
import KnightEnduringFightBehavior from "./aiClassBehaviors/KnightEnduringFightBehavior";
import KnightFieryFightBehavior from "./aiClassBehaviors/KnightFieryFightBehavior";
import TankRiposteFightBehavior from "./aiClassBehaviors/TankRiposteFightBehavior";
import PaladinJusticarFightBehavior from "./aiClassBehaviors/PaladinJusticarFightBehavior";
import GunnerCannoneerFightBehavior from "./aiClassBehaviors/GunnerCannoneerFightBehavior";
import VeteranChargerFightBehavior from "./aiClassBehaviors/VeteranChargerFightBehavior";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";

export interface ClassBehavior {
	chooseAction(fighter: AiPlayerFighter, fightView: FightView): FightAction;
}

// Type for behavior constructor
type ClassBehaviorConstructor = new () => ClassBehavior;

/*
 * Personalities of a class: each fight, the AI picks one of them at random so it is less predictable.
 * Every personality registered here was checked to be about as strong as the others in simulated fights.
 */
const classBehaviorConstructors = new Map<number, ClassBehaviorConstructor[]>();

const KNIGHT_PERSONALITIES = [
	KnightFightBehavior,
	KnightEnduringFightBehavior,
	KnightFieryFightBehavior
];
const TANK_PERSONALITIES = [TankFightBehavior, TankRiposteFightBehavior];
const PALADIN_PERSONALITIES = [PaladinFightBehavior, PaladinJusticarFightBehavior];
const GUNNER_PERSONALITIES = [GunnerFightBehavior, GunnerCannoneerFightBehavior];
const VETERAN_PERSONALITIES = [VeteranFightBehavior, VeteranChargerFightBehavior];

/**
 * Initialize all class behaviors in a map so they can be accessed by class ID
 */
export function initializeAllClassBehaviors(): void {
	registerClassBehavior(ClassConstants.CLASSES_ID.KNIGHT, ...KNIGHT_PERSONALITIES);
	registerClassBehavior(ClassConstants.CLASSES_ID.VALIANT_KNIGHT, ...KNIGHT_PERSONALITIES);
	registerClassBehavior(ClassConstants.CLASSES_ID.PIKEMAN, ...KNIGHT_PERSONALITIES);
	registerClassBehavior(ClassConstants.CLASSES_ID.HORSE_RIDER, HorseRiderFightBehavior);
	registerClassBehavior(ClassConstants.CLASSES_ID.ESQUIRE, EsquireFightBehavior);
	registerClassBehavior(ClassConstants.CLASSES_ID.MYSTIC_MAGE, MysticMageFightBehavior);
	registerClassBehavior(ClassConstants.CLASSES_ID.FORMIDABLE_GUNNER, ...GUNNER_PERSONALITIES);
	registerClassBehavior(ClassConstants.CLASSES_ID.GUNNER, ...GUNNER_PERSONALITIES);
	registerClassBehavior(ClassConstants.CLASSES_ID.ARCHER, ...GUNNER_PERSONALITIES);
	registerClassBehavior(ClassConstants.CLASSES_ID.SLINGER, SlingerFightBehavior);
	registerClassBehavior(ClassConstants.CLASSES_ID.ROCK_THROWER, RockThrowerFightBehavior);
	registerClassBehavior(ClassConstants.CLASSES_ID.POWERFUL_INFANTRYMAN, InfantryManFightBehavior);
	registerClassBehavior(ClassConstants.CLASSES_ID.INFANTRYMAN, InfantryManFightBehavior);
	registerClassBehavior(ClassConstants.CLASSES_ID.SOLDIER, InfantryManFightBehavior);
	registerClassBehavior(ClassConstants.CLASSES_ID.FIGHTER, FighterFightBehavior);
	registerClassBehavior(ClassConstants.CLASSES_ID.RECRUIT, RecruitFightBehavior);
	registerClassBehavior(ClassConstants.CLASSES_ID.VETERAN, ...VETERAN_PERSONALITIES);
	registerClassBehavior(ClassConstants.CLASSES_ID.EXPERIENCED_VETERAN, ...VETERAN_PERSONALITIES);
	registerClassBehavior(ClassConstants.CLASSES_ID.PALADIN, ...PALADIN_PERSONALITIES);
	registerClassBehavior(ClassConstants.CLASSES_ID.LUMINOUS_PALADIN, ...PALADIN_PERSONALITIES);
	registerClassBehavior(ClassConstants.CLASSES_ID.TANK, ...TANK_PERSONALITIES);
	registerClassBehavior(ClassConstants.CLASSES_ID.IMPENETRABLE_TANK, ...TANK_PERSONALITIES);
	registerClassBehavior(ClassConstants.CLASSES_ID.ENMESHED, ...TANK_PERSONALITIES);
	registerClassBehavior(ClassConstants.CLASSES_ID.HELMETED, HelmetedFightBehavior);
	registerClassBehavior(ClassConstants.CLASSES_ID.GLOVED, GlovedFightBehavior);
}

/**
 * Register the personalities of a class, replacing the previous ones
 * @param classId The class ID
 * @param personalities The behavior constructors, one per personality
 */
export function registerClassBehavior(classId: number, ...personalities: ClassBehaviorConstructor[]): void {
	classBehaviorConstructors.set(classId, personalities);
}

/**
 * Get a new instance of class behavior by class ID, with one of the class personalities picked at random
 * @param classId The class ID
 * @returns A new instance of the class behavior or undefined if not found
 */
export function getAiClassBehavior(classId: number): ClassBehavior | undefined {
	const personalities = classBehaviorConstructors.get(classId);
	if (!personalities || personalities.length === 0) {
		return undefined;
	}
	const Personality = RandomUtils.crowniclesRandom.pick(personalities);
	return new Personality();
}
