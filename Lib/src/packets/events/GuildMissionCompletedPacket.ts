import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class GuildMissionCompletedPacket extends CrowniclesPacket {
	guildXp!: number;

	guildScore!: number;

	treasuryGold!: number;

	personalXp!: number;

	keycloakId!: string;
}
