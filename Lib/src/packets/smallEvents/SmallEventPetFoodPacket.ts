import {
	PacketDirection,
	sendablePacket
} from "../CrowniclesPacket";
import { SmallEventPacket } from "./SmallEventPacket";
import { SexTypeShort } from "../../constants/StringConstants";

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class SmallEventPetFoodPacket extends SmallEventPacket {
	outcome!: string; // "found_by_player", "found_by_pet", "found_anyway", "nothing", "pet_failed", "player_failed"

	foodType!: string; // translation key for the food

	loveChange!: number;

	timeLost?: number; // Time lost in minutes when investigating

	petSex!: SexTypeShort; // Sex of the pet for gendered translations
}
