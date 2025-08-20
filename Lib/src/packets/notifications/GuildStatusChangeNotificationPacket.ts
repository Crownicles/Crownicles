import { NotificationPacket } from "./NotificationPacket";

export class GuildStatusChangeNotificationPacket extends NotificationPacket {
	guildName!: string;

	becomeChief?: boolean;

	becomeElder?: boolean; // True if become an elder, empty if become a member and becomeChief is empty
}
