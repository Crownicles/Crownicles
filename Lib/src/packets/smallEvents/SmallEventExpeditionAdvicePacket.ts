import {
	PacketDirection,
	sendablePacket
} from "../CrowniclesPacket";
import { SmallEventPacket } from "./SmallEventPacket";
import { SexTypeShort } from "../../constants/StringConstants";
import { ItemWithDetails } from "../../types/ItemWithDetails";

/**
 * Interaction types for the expedition advice small event
 */
export enum ExpeditionAdviceInteractionType {

	// Phase 1: Talisman introduction (first 2 encounters)
	TALISMAN_INTRO = "talismanIntro",

	// Phase 2: Check conditions before giving talisman (in order)
	CONDITION_NOT_MET_NO_PET = "conditionNotMetNoPet",
	CONDITION_NOT_MET_PET_HUNGRY = "conditionNotMetPetHungry",
	CONDITION_NOT_MET_PET_FEISTY = "conditionNotMetPetFeisty",
	CONDITION_NOT_MET_NO_GUILD = "conditionNotMetNoGuild",
	CONDITION_NOT_MET_PET_NOT_SEEN_BY_TALVAR = "conditionNotMetPetNotSeenByTalvar",
	CONDITION_NOT_MET_LEVEL_TOO_LOW = "conditionNotMetLevelTooLow",

	// Phase 2: Talisman given
	TALISMAN_RECEIVED = "talismanReceived",

	// Already has talisman: bonus or advice
	EXPEDITION_BONUS = "expeditionBonus",
	ADVICE = "advice"
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class SmallEventExpeditionAdvicePacket extends SmallEventPacket {
	/**
	 * Whether the player already has the talisman
	 */
	alreadyHasTalisman!: boolean;

	/**
	 * Whether a talisman was given
	 */
	talismanGiven!: boolean;

	/**
	 * Whether the player has a pet in expedition
	 */
	petInExpedition!: boolean;

	/**
	 * Bonus points given if pet was in expedition (always given)
	 */
	bonusPoints?: number;

	/**
	 * Bonus money given if pet was in expedition (20% chance when no combat potion)
	 */
	bonusMoney?: number;

	/**
	 * Bonus item given if pet was in expedition (20% chance when no money and no combat potion)
	 */
	bonusItem?: ItemWithDetails;

	/**
	 * Combat potion given if pet was in expedition (15% chance, replaces other rewards)
	 */
	bonusCombatPotion?: ItemWithDetails;

	/**
	 * Pet information (if pet is in expedition)
	 */
	petTypeId?: number;

	petSex?: SexTypeShort;

	petNickname?: string;

	/**
	 * The interaction type for translation
	 */
	interactionType!: string;

	/**
	 * Number of encounters with this small event (for progressive lore)
	 */
	encounterCount?: number;

	/**
	 * Required level for talisman (if level condition not met)
	 */
	requiredLevel?: number;

	/**
	 * Current player level (if level condition not met)
	 */
	playerLevel?: number;

	/**
	 * Whether a consolation token was given (when level is too low for talisman)
	 */
	consolationTokenGiven?: boolean;

	/**
	 * Number of consolation tokens given
	 */
	consolationTokensAmount?: number;
}
