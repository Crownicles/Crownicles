import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";
import { TopDataType } from "../../types/TopDataType";
import { TopTiming } from "../../types/TopTimings";
import {
	TopElement, TopElementGlory, TopElementGuild, TopElementScore
} from "../../types/TopElement";

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandTopPacketReq extends CrowniclesPacket {
	dataType!: TopDataType;

	timing!: TopTiming;

	page?: number;
}

@sendablePacket(PacketDirection.NONE)
export class CommandTopPacketRes<T extends TopElement<unknown, unknown, unknown>> extends CrowniclesPacket {
	timing!: TopTiming;

	contextRank?: number;

	canBeRanked!: boolean;

	elements!: T[];

	totalElements!: number;

	elementsPerPage!: number;

	initialPage?: number;
}

// Attributes: mapType and afk, score, level
@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandTopPacketResScore extends CommandTopPacketRes<TopElementScore> {
}

// Attributes: leagueId, glory, level
@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandTopPacketResGlory extends CommandTopPacketRes<TopElementGlory> {
	needFight!: number;
}

// Attributes: guild points, level, none
@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandTopPacketResGuild extends CommandTopPacketRes<TopElementGuild> {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandTopPlayersEmptyPacket extends CrowniclesPacket {
	needFight?: number;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandTopGuildsEmptyPacket extends CrowniclesPacket {
}
