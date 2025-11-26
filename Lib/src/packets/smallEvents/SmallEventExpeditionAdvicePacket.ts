import {
	PacketDirection,
	sendablePacket
} from "../CrowniclesPacket";
import { SmallEventPacket } from "./SmallEventPacket";
import { SexTypeShort } from "../../constants/StringConstants";

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
	 * Bonus money given if pet was in expedition
	 */
	bonusMoney?: number;

	/**
	 * Bonus experience given if pet was in expedition
	 */
	bonusExperience?: number;

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
}
