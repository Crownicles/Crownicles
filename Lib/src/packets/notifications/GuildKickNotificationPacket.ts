import { NotificationPacket } from "./NotificationPacket";

export class GuildKickNotificationPacket extends NotificationPacket {
	keycloakIdOfExecutor!: string;

	guildName!: string;
}
