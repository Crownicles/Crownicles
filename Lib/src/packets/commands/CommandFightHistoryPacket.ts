import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";
import { EloGameResult } from "../../types/EloGameResult";
import { KingGuardFightStats } from "../../types/KingGuardFightStats";

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
 * Fight against a king guard: always initiated by the player, no glory at stake.
 * The id of the guard is absent for the guards generated on the fly before the library existed
 */
export type KingGuardFightHistoryItem = FightHistoryItemBase & {
	kingGuard: {
		level: number;
		id?: number;
	};
};

export type FightHistoryItem = PlayerFightHistoryItem | KingGuardFightHistoryItem;

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandFightHistoryPacketReq extends CrowniclesPacket {}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandFightHistoryPacketRes extends CrowniclesPacket {
	history!: FightHistoryItem[];

	// Absent when the player never fought a king guard
	kingGuardStats?: KingGuardFightStats;
}
