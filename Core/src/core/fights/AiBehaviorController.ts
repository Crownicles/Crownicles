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
import {
	AiPersonality, AiPersonalityConstants
} from "../../../../Lib/src/constants/AiPersonalityConstants";

export interface ClassBehavior {
	chooseAction(fighter: AiPlayerFighter, fightView: FightView): FightAction;
}

// Type for behavior constructor
type ClassBehaviorConstructor = new () => ClassBehavior;

/**
 * One of the ways a class fights. Classes with several viable ways expose them with an identifier,
 * so that a player can pick the one defending them
 */
type ClassPersonality = {
	id?: AiPersonality;
	behavior: ClassBehaviorConstructor;
};

/*
 * Personalities of a class: unless the player picked one, the AI picks one of them at random at each fight so it is
 * less predictable. Every named personality registered here was checked to be about as strong as the others in simulated fights.
 */
const classPersonalities = new Map<number, ClassPersonality[]>();

const KNIGHT_PERSONALITIES: ClassPersonality[] = [
	{
		id: AiPersonalityConstants.PERSONALITIES.KNIGHT_STRATEGIST, behavior: KnightFightBehavior
	},
	{
		id: AiPersonalityConstants.PERSONALITIES.KNIGHT_ENDURING, behavior: KnightEnduringFightBehavior
	},
	{
		id: AiPersonalityConstants.PERSONALITIES.KNIGHT_FIERY, behavior: KnightFieryFightBehavior
	}
];
const TANK_PERSONALITIES: ClassPersonality[] = [
	{
		id: AiPersonalityConstants.PERSONALITIES.TANK_BULWARK, behavior: TankFightBehavior
	},
	{
		id: AiPersonalityConstants.PERSONALITIES.TANK_RIPOSTE, behavior: TankRiposteFightBehavior
	}
];
const PALADIN_PERSONALITIES: ClassPersonality[] = [
	{
		id: AiPersonalityConstants.PERSONALITIES.PALADIN_CRUSADER, behavior: PaladinFightBehavior
	},
	{
		id: AiPersonalityConstants.PERSONALITIES.PALADIN_JUSTICAR, behavior: PaladinJusticarFightBehavior
	}
];
const GUNNER_PERSONALITIES: ClassPersonality[] = [
	{
		id: AiPersonalityConstants.PERSONALITIES.GUNNER_STRATEGIST, behavior: GunnerFightBehavior
	},
	{
		id: AiPersonalityConstants.PERSONALITIES.GUNNER_CANNONEER, behavior: GunnerCannoneerFightBehavior
	}
];
const VETERAN_PERSONALITIES: ClassPersonality[] = [
	{
		id: AiPersonalityConstants.PERSONALITIES.VETERAN_STRATEGIST, behavior: VeteranFightBehavior
	},
	{
		id: AiPersonalityConstants.PERSONALITIES.VETERAN_CHARGER, behavior: VeteranChargerFightBehavior
	}
];

/**
 * Initialize all class behaviors in a map so they can be accessed by class ID
 */
export function initializeAllClassBehaviors(): void {
	registerClassBehavior(ClassConstants.CLASSES_ID.KNIGHT, ...KNIGHT_PERSONALITIES);
	registerClassBehavior(ClassConstants.CLASSES_ID.VALIANT_KNIGHT, ...KNIGHT_PERSONALITIES);
	registerClassBehavior(ClassConstants.CLASSES_ID.PIKEMAN, ...KNIGHT_PERSONALITIES);
	registerClassBehavior(ClassConstants.CLASSES_ID.HORSE_RIDER, { behavior: HorseRiderFightBehavior });
	registerClassBehavior(ClassConstants.CLASSES_ID.ESQUIRE, { behavior: EsquireFightBehavior });
	registerClassBehavior(ClassConstants.CLASSES_ID.MYSTIC_MAGE, { behavior: MysticMageFightBehavior });
	registerClassBehavior(ClassConstants.CLASSES_ID.FORMIDABLE_GUNNER, ...GUNNER_PERSONALITIES);
	registerClassBehavior(ClassConstants.CLASSES_ID.GUNNER, ...GUNNER_PERSONALITIES);
	registerClassBehavior(ClassConstants.CLASSES_ID.ARCHER, ...GUNNER_PERSONALITIES);
	registerClassBehavior(ClassConstants.CLASSES_ID.SLINGER, { behavior: SlingerFightBehavior });
	registerClassBehavior(ClassConstants.CLASSES_ID.ROCK_THROWER, { behavior: RockThrowerFightBehavior });
	registerClassBehavior(ClassConstants.CLASSES_ID.POWERFUL_INFANTRYMAN, { behavior: InfantryManFightBehavior });
	registerClassBehavior(ClassConstants.CLASSES_ID.INFANTRYMAN, { behavior: InfantryManFightBehavior });
	registerClassBehavior(ClassConstants.CLASSES_ID.SOLDIER, { behavior: InfantryManFightBehavior });
	registerClassBehavior(ClassConstants.CLASSES_ID.FIGHTER, { behavior: FighterFightBehavior });
	registerClassBehavior(ClassConstants.CLASSES_ID.RECRUIT, { behavior: RecruitFightBehavior });
	registerClassBehavior(ClassConstants.CLASSES_ID.VETERAN, ...VETERAN_PERSONALITIES);
	registerClassBehavior(ClassConstants.CLASSES_ID.EXPERIENCED_VETERAN, ...VETERAN_PERSONALITIES);
	registerClassBehavior(ClassConstants.CLASSES_ID.PALADIN, ...PALADIN_PERSONALITIES);
	registerClassBehavior(ClassConstants.CLASSES_ID.LUMINOUS_PALADIN, ...PALADIN_PERSONALITIES);
	registerClassBehavior(ClassConstants.CLASSES_ID.TANK, ...TANK_PERSONALITIES);
	registerClassBehavior(ClassConstants.CLASSES_ID.IMPENETRABLE_TANK, ...TANK_PERSONALITIES);
	registerClassBehavior(ClassConstants.CLASSES_ID.ENMESHED, ...TANK_PERSONALITIES);
	registerClassBehavior(ClassConstants.CLASSES_ID.HELMETED, { behavior: HelmetedFightBehavior });
	registerClassBehavior(ClassConstants.CLASSES_ID.GLOVED, { behavior: GlovedFightBehavior });
}

/**
 * Register the personalities of a class, replacing the previous ones
 * @param classId The class ID
 * @param personalities The ways the class fights
 */
export function registerClassBehavior(classId: number, ...personalities: ClassPersonality[]): void {
	classPersonalities.set(classId, personalities);
}

/**
 * Get the personalities a player of this class can pick to defend them
 * @param classId The class ID
 * @returns The personality identifiers, empty when the class has a single way to fight
 */
export function getAiPersonalities(classId: number): AiPersonality[] {
	return (classPersonalities.get(classId) ?? [])
		.map(personality => personality.id)
		.filter((id): id is AiPersonality => id !== undefined);
}

/**
 * Get a new instance of class behavior by class ID
 * @param classId The class ID
 * @param preferredPersonality The personality picked by the player, ignored if it does not belong to the class
 * @returns A new instance of the class behavior, with the preferred personality or one picked at random, or undefined if not found
 */
export function getAiClassBehavior(classId: number, preferredPersonality: AiPersonality | null = null): ClassBehavior | undefined {
	const personalities = classPersonalities.get(classId);
	if (!personalities || personalities.length === 0) {
		return undefined;
	}
	const { behavior: Behavior } = personalities.find(candidate => candidate.id !== undefined && candidate.id === preferredPersonality)
		?? RandomUtils.crowniclesRandom.pick(personalities);
	return new Behavior();
}
