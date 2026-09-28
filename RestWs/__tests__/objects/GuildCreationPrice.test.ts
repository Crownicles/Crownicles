import {
	describe, expect, it
} from "vitest";
import { GuildCreateConstants } from "../../../Lib/src/constants/GuildCreateConstants";
import { GUILD_CREATION_PRICE } from "../../../WsPackets/src/objects/Guild";

describe("guild creation price shown by the app", () => {
	it("matches the price Core charges", () => {
		expect(GUILD_CREATION_PRICE).toBe(GuildCreateConstants.PRICE);
	});
});
