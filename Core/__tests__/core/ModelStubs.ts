import { vi } from "vitest";
import Player from "../../src/core/database/game/models/Player";
import Home from "../../src/core/database/game/models/Home";

/**
 * A test stub stands for the player model: the code under test only uses the members the stub implements,
 * while a real Sequelize model cannot be built without a database
 */
export function asPlayer(stub: object): Player {
	return stub as unknown as Player;
}

/**
 * Home with the Home prototype, so that its methods (getLevel, etc.) work, and the given fields
 */
export function makeHome(overrides: Partial<Pick<Home, "id" | "ownerId" | "cityId" | "level">> = {}): Home {
	return Object.assign(Object.create(Home.prototype) as Home, {
		id: 3,
		ownerId: 1,
		cityId: "boug_coton",
		level: 1,
		save: vi.fn().mockResolvedValue(undefined),
		...overrides
	});
}
