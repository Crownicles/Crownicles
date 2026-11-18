import { NotificationPacket } from "./NotificationPacket";
import { PlantId } from "../../constants/PlantConstants";

export class GardenPlantReadyNotificationPacket extends NotificationPacket {
	plantIds!: PlantId[];
}
