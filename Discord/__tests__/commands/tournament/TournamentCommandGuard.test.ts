import {
	describe, expect, it
} from "vitest";
import { isAllowedInTournament } from "../../../src/commands/tournament/TournamentCommandGuard";

describe("TournamentCommandGuard", () => {
	it("only allows registration for non-participants", () => {
		expect(isAllowedInTournament("tournament-register", false, false)).toBe(true);
		expect(isAllowedInTournament("top", false, false)).toBe(false);
		expect(isAllowedInTournament("notifications", false, false)).toBe(false);
	});

	it("allows tournament gameplay only for participants", () => {
		expect(isAllowedInTournament("fight", true, false)).toBe(true);
		expect(isAllowedInTournament("top", true, false)).toBe(true);
		expect(isAllowedInTournament("inventory", true, false)).toBe(false);
	});

	it("keeps resume owner-only", () => {
		expect(isAllowedInTournament("tournament-resume", false, true)).toBe(true);
		expect(isAllowedInTournament("tournament-resume", true, false)).toBe(false);
	});
});