import {
	PacketDirection,
	sendablePacket
} from "../CrowniclesPacket";
import { SmallEventPacket } from "./SmallEventPacket";

@sendablePacket(PacketDirection.NONE)
export class SmallEventPetFoodPacket extends SmallEventPacket {
	outcome!: string; // "found_by_player", "found_by_pet", "found_anyway", "nothing", "pet_failed"
	food!: string; // translation key for the food
	loveChange!: number;
}
