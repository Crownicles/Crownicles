import {
	PacketDirection,
	sendablePacket
} from "../CrowniclesPacket";
import { SmallEventPacket } from "./SmallEventPacket";

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class SmallEventPetFoodPacket extends SmallEventPacket {
	outcome!: string; // "found_by_player", "found_by_pet", "found_anyway", "nothing", "pet_failed"

	foodType!: string; // translation key for the food

	loveChange!: number;
}
