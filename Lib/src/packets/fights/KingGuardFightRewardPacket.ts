import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";
import { FightRewardPacket } from "./FightRewardPacket";
import { SexTypeShort } from "../../constants/StringConstants";

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class KingGuardFightRewardPacket extends CrowniclesPacket {
	points!: number;

	money!: number;

	draw!: boolean;

	won!: boolean;

	// The fronts name the guard from its id, and agree the recap with its sex
	guard!: {
		id: number;
		sex: SexTypeShort;
	};

	petLoveChange?: FightRewardPacket["petLoveChange"];
}
