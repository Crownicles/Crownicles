import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";
import { EloGameResult } from "../../types/EloGameResult";

export type FightHistoryItem = {
	initiator: boolean;

	opponentKeycloakId: string;

	result: EloGameResult;

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

	classes: {
		me: number;
		opponent: number;
	};

	date: number;
};

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandFightHistoryPacketReq extends CrowniclesPacket {}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandFightHistoryPacketRes extends CrowniclesPacket {
	history!: FightHistoryItem[];
}
