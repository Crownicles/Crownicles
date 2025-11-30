import { NotificationPacket } from "./NotificationPacket";

export class ExpeditionFinishedNotificationPacket extends NotificationPacket {
	petId!: number;

	petSex!: string;

	petNickname?: string;
}
