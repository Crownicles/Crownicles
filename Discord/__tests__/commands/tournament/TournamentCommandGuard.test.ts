import {
	describe, expect, it
} from "vitest";
import { PermissionsBitField } from "discord.js";
import { isAllowedInTournament } from "../../../src/commands/tournament/TournamentCommandGuard";
import { commandInfo as tournamentAdminCommandInfo } from "../../../src/commands/tournament/TournamentAdminCommand";
import { commandInfo as tournamentOwnerCommandInfo } from "../../../src/commands/tournament/TournamentOwnerCommand";
import { commandInfo } from "../../../src/commands/tournament/TournamentStatusCommand";

describe("TournamentCommandGuard", () => {
	it("allows the player command for non-participants", () => {
		expect(isAllowedInTournament("tournament", false, false)).toBe(true);
		expect(isAllowedInTournament("top", false, false)).toBe(false);
		expect(isAllowedInTournament("notifications", false, false)).toBe(false);
	});

	it("allows tournament gameplay only for participants", () => {
		expect(isAllowedInTournament("fight", true, false)).toBe(true);
		expect(isAllowedInTournament("top", true, false)).toBe(true);
		expect(isAllowedInTournament("inventory", true, false)).toBe(false);
	});

	it("allows the dedicated management roots through the context guard", () => {
		expect(isAllowedInTournament("tournament-admin", false, false)).toBe(true);
		expect(isAllowedInTournament("tournament-owner", false, false)).toBe(true);
	});

	it("registers the player command as a global command", () => {
		expect(commandInfo.slashCommandBuilder.name).toBe("tournament");
		expect(commandInfo.mainGuildCommand).toBe(false);
	});

	it("registers management roots without options and with Discord permissions", () => {
		const adminCommand = tournamentAdminCommandInfo.slashCommandBuilder.toJSON();
		const ownerCommand = tournamentOwnerCommandInfo.slashCommandBuilder.toJSON();

		expect(adminCommand.options).toEqual([]);
		expect(ownerCommand.options).toEqual([]);
		expect(adminCommand.default_member_permissions).toBe(PermissionsBitField.Flags.Administrator.toString());
		expect(ownerCommand.default_member_permissions).toBe(PermissionsBitField.Flags.Administrator.toString());
	});
});