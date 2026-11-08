import {
	beforeAll, describe, expect, it
} from "vitest";
import { Sequelize } from "sequelize";
import Player, { initModel } from "../../../../src/core/database/game/models/Player";

describe("a new character", () => {
	beforeAll(() => {
		// Building an instance applies the model defaults without touching a database.
		initModel(new Sequelize({
			dialect: "mariadb",
			logging: false
		}));
	});

	it("starts with a full health bar, never above its max health (#5070)", () => {
		const player = Player.build({ keycloakId: "new-character" });

		expect(player.getHealthValue()).toBe(player.getMaxHealth());
	});
});
