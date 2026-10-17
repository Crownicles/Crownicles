import { NotificationPacket } from "./NotificationPacket";
import { TournamentDefenseOutcome } from "../../types/Tournament";

export class TournamentDefenseNotificationPacket extends NotificationPacket {
	attackerKeycloakId!: string;

	outcome!: TournamentDefenseOutcome;

	gloryChange!: number;
}
