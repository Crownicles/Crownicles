import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";
import { TopDataType } from "../../types/TopDataType";
import { TopTiming } from "../../types/TopTimings";
import {
	TopElement, TopElementScoreFirstType
} from "../../types/TopElement";

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandTopPacketReq extends CrowniclesPacket {
	dataType!: TopDataType;

	timing!: TopTiming;

	page?: number;
}

@sendablePacket(PacketDirection.NONE)
export class CommandTopPacketRes<T extends TopElement<Attr1, Attr2, Attr3>, Attr1, Attr2, Attr3> extends CrowniclesPacket {
	timing!: TopTiming;

	minRank!: number;

	maxRank!: number;

	contextRank?: number;

	canBeRanked!: boolean;

	elements!: T[];

	totalElements!: number;

	elementsPerPage!: number;
}

// Attributes: mapType and afk, score, level
@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandTopPacketResScore extends CommandTopPacketRes<TopElement<TopElementScoreFirstType, number, number>, TopElementScoreFirstType, number, number> {
}

// Attributes: leagueId, glory, level
@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandTopPacketResGlory extends CommandTopPacketRes<TopElement<number, number, number>, number, number, number> {
	needFight!: number;
}

// Attributes: guild points, level, none
@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandTopPacketResGuild extends CommandTopPacketRes<TopElement<number, number, undefined>, number, number, undefined> {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandTopInvalidPagePacket extends CrowniclesPacket {
	minPage!: number;

	maxPage!: number;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandTopPlayersEmptyPacket extends CrowniclesPacket {
	needFight?: number;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandTopGuildsEmptyPacket extends CrowniclesPacket {
}
