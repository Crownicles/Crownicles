import { SmallEventPacket } from "./SmallEventPacket";
import {
	PacketDirection, sendablePacket
} from "../CrowniclesPacket";
import {
	GardenerInteractionName, SeedConditionKey
} from "../../constants/PlantConstants";

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class SmallEventGardenerPacket extends SmallEventPacket {
	interactionName!: GardenerInteractionName;

	plantId!: number;

	materialId!: number;

	cost!: number;

	conditionKey!: SeedConditionKey;
}
