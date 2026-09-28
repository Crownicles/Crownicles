import {
	describe, expect, it
} from "vitest";
import { GuildCreateConstants } from "../../../Lib/src/constants/GuildCreateConstants";
import { GuildConstants } from "../../../Lib/src/constants/GuildConstants";
import { GuildRecruitmentConstants } from "../../../Lib/src/constants/GuildRecruitmentConstants";
import {
	GUILD_CREATION_PRICE, MAX_GUILD_MEMBERS
} from "../../../WsPackets/src/objects/Guild";
import { GUILD_RECRUITMENT_MIN_SCORE_STEPS } from "../../../WsPackets/src/objects/GuildRecruitment";

describe("guild creation price shown by the app", () => {
	it("matches the price Core charges", () => {
		expect(GUILD_CREATION_PRICE).toBe(GuildCreateConstants.PRICE);
	});
});

describe("guild size shown by the app", () => {
	it("matches the limit Core enforces", () => {
		expect(MAX_GUILD_MEMBERS).toBe(GuildConstants.MAX_GUILD_MEMBERS);
	});
});

describe("recruitment minimum scores offered by the app", () => {
	it("are the steps Core accepts", () => {
		expect(GUILD_RECRUITMENT_MIN_SCORE_STEPS).toEqual(GuildRecruitmentConstants.MIN_SCORE_STEPS);
	});
});
