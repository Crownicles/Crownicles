import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class PlayerLevelUpPacket extends CrowniclesPacket {
	keycloakId!: string;

	level!: number;

	fightUnlocked!: boolean;

	guildUnlocked!: boolean;

	healthRestored!: boolean;

	classesTier1Unlocked!: boolean;

	classesTier2Unlocked!: boolean;

	classesTier3Unlocked!: boolean;

	classesTier4Unlocked!: boolean;

	classesTier5Unlocked!: boolean;

	missionSlotUnlocked!: boolean;

	pveUnlocked!: boolean;

	tokensUnlocked!: boolean;

	statsIncreased!: boolean;
}
