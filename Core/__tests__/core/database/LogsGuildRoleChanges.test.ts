import {
	beforeEach, describe, expect, it, vi
} from "vitest";

vi.mock("../../../src/core/database/logs/LogsGuildResolver", () => ({
	findOrCreateLogsGuild: vi.fn()
}));

import { LogsDatabase } from "../../../src/core/database/logs/LogsDatabase";
import { findOrCreateLogsGuild } from "../../../src/core/database/logs/LogsGuildResolver";
import { Players } from "../../../src/core/database/game/models/Player";
import { LogsGuildsEldersRemoves } from "../../../src/core/database/logs/models/LogsGuildsEldersRemoves";
import { LogsGuildsChiefsChanges } from "../../../src/core/database/logs/models/LogsGuildsChiefsChanges";
import { Guild } from "../../../src/core/database/game/models/Guild";

const LOG_GUILD_ID = 7;
const LOG_PLAYER_ID = 42;

describe("LogsDatabase guild role changes", () => {
	const guild = {
		id: 3, name: "RoleGuild", creationDate: new Date(), chiefId: 1
	} as Guild;
	const logs = Object.create(LogsDatabase.prototype) as LogsDatabase;

	beforeEach(() => {
		vi.restoreAllMocks();
		vi.spyOn(Players, "getById").mockRejectedValue(new Error("commit has been called on this transaction"));
		vi.mocked(findOrCreateLogsGuild).mockResolvedValue({ id: LOG_GUILD_ID } as never);
		vi.spyOn(LogsDatabase, "findOrCreatePlayer").mockResolvedValue({ id: LOG_PLAYER_ID } as never);
		vi.spyOn(LogsGuildsEldersRemoves, "create").mockResolvedValue({} as never);
		vi.spyOn(LogsGuildsChiefsChanges, "create").mockResolvedValue({} as never);
	});

	it("logs a demoted elder from its keycloak id without reading the game database", async () => {
		await logs.logGuildElderRemove(guild, "elder-keycloak-id");

		expect(LogsDatabase.findOrCreatePlayer).toHaveBeenCalledWith("elder-keycloak-id");
		expect(LogsGuildsEldersRemoves.create).toHaveBeenCalledWith(expect.objectContaining({
			guildId: LOG_GUILD_ID, removedElder: LOG_PLAYER_ID
		}));
	});

	it("logs a new chief from its keycloak id without reading the game database", async () => {
		await logs.logGuildChiefChange(guild, "chief-keycloak-id");

		expect(LogsDatabase.findOrCreatePlayer).toHaveBeenCalledWith("chief-keycloak-id");
		expect(LogsGuildsChiefsChanges.create).toHaveBeenCalledWith(expect.objectContaining({
			guildId: LOG_GUILD_ID, newChief: LOG_PLAYER_ID
		}));
	});
});
