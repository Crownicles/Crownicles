import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";
import { EloGameResult } from "../../types/EloGameResult";

type FightHistoryItemBase = {
	result: EloGameResult;

	classes: {
		me: number;
		opponent: number;
	};

	date: number;
};

export type PlayerFightHistoryItem = FightHistoryItemBase & {
	initiator: boolean;

	opponentKeycloakId: string;

	glory: {
		initial: {
			me: number;
			opponent: number;
		};
		change: {
			me: number;
			opponent: number;
		};
		leaguesChanges: {
			me?: {
				oldLeague: number;
				newLeague: number;
			};
			opponent?: {
				oldLeague: number;
				newLeague: number;
			};
		};
	};
};

/**
 * Fight against a king guard: always initiated by the player, no glory at stake
 */
export type KingGuardFightHistoryItem = FightHistoryItemBase & {
	kingGuard: {
		level: number;
	};
};

export type FightHistoryItem = PlayerFightHistoryItem | KingGuardFightHistoryItem;

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandFightHistoryPacketReq extends CrowniclesPacket {}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandFightHistoryPacketRes extends CrowniclesPacket {
	history!: FightHistoryItem[];
}
