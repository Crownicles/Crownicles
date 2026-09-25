import {
	describe, expect, it
} from "vitest";
import { ClassConstants } from "../../../Lib/src/constants/ClassConstants";
import { FightConstants } from "../../../Lib/src/constants/FightConstants";
import { GuildConstants } from "../../../Lib/src/constants/GuildConstants";
import { JOURNEY_LEVELS } from "../../../WsPackets/src/objects/Journey";

describe("journey levels shown by the app", () => {
	it("match the levels Core requires", () => {
		expect(JOURNEY_LEVELS).toEqual({
			CLASSES: ClassConstants.REQUIRED_LEVEL,
			FIGHTS: FightConstants.REQUIRED_LEVEL,
			GUILD: GuildConstants.REQUIRED_LEVEL
		});
	});
});
