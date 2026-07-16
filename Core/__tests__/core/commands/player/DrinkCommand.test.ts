import {
	beforeEach, describe, expect, it, vi
} from "vitest";
import DrinkCommand from "../../../../src/commands/player/DrinkCommand";
import { InventorySlots } from "../../../../src/core/database/game/models/InventorySlot";
import { toItemWithDetails } from "../../../../src/core/utils/ItemUtils";
import { ItemCategory, ItemNature } from "../../../../../Lib/src/constants/ItemConstants";

vi.mock("../../../../src/core/utils/CommandUtils", () => ({
	commandRequires: () => (_target: unknown, _propertyKey: string, descriptor: PropertyDescriptor) => descriptor,
	CommandUtils: {
		DISALLOWED_EFFECTS: {
			NOT_STARTED_OR_DEAD_OR_JAILED: []
		}
	}
}));
vi.mock("../../../../src/core/database/game/models/InventorySlot");
vi.mock("../../../../src/core/utils/ItemUtils");

describe("DrinkCommand", () => {
	const player = {
		id: 42,
		keycloakId: "player-keycloak-id",
		insideCity: false
	};
	const timePotionSlot = {
		itemId: 1,
		itemCategory: ItemCategory.POTION,
		itemLevel: 0,
		itemEnchantmentId: null,
		isPotion: () => true,
		getItem: () => ({
			id: 1,
			nature: ItemNature.TIME_SPEEDUP,
			isFightPotion: () => false
		})
	};
	const healthPotionSlot = {
		...timePotionSlot,
		getItem: () => ({
			id: 2,
			nature: ItemNature.HEALTH,
			isFightPotion: () => false
		})
	};

	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(InventorySlots.getOfPlayer).mockResolvedValue([timePotionSlot as never]);
		vi.mocked(toItemWithDetails).mockReturnValue({ id: 1 } as never);
		player.insideCity = false;
	});

	async function executeCommand(): Promise<unknown[]> {
		const response: unknown[] = [];
		await new DrinkCommand().execute(response as never, player as never, {} as never, {} as never);
		return response;
	}

	it("offers time potions whenever the player is outside a city", async () => {
		const response = await executeCommand();

		expect(response[0]?.constructor.name).toBe("ReactionCollectorCreationPacket");
	});

	it("hides time potions while the player is inside a city", async () => {
		player.insideCity = true;

		const response = await executeCommand();

		expect(response[0]?.constructor.name).toBe("CommandDrinkNoAvailablePotion");
	});

	it("keeps regular potions available inside a city", async () => {
		player.insideCity = true;
		vi.mocked(InventorySlots.getOfPlayer).mockResolvedValue([healthPotionSlot as never]);

		const response = await executeCommand();

		expect(response[0]?.constructor.name).toBe("ReactionCollectorCreationPacket");
	});
});
