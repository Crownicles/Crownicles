import { SmallEventPacket } from "./SmallEventPacket";
import {
	PacketDirection, sendablePacket
} from "../CrowniclesPacket";
import { SexTypeShort } from "../../constants/StringConstants";
import { PetFood } from "../../types/PetFood";

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class SmallEventPetPacket extends SmallEventPacket {
	interactionName!: string;

	petTypeId!: number;

	petSex!: SexTypeShort;

	petNickname!: string | undefined;

	randomPetTypeId!: number;

	randomPetSex!: SexTypeShort;

	amount?: number; // Quantity of win/lose health points,money,energy,etc.

	food?: PetFood; // The name of the food
}
