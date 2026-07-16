import {
	beforeEach, describe, expect, it, vi
} from "vitest";
import DrinkCommand from "../../../../src/commands/player/DrinkCommand";
import { InventorySlots } from "../../../../src/core/database/game/models/InventorySlot";
import { Maps } from "../../../../src/core/maps/Maps";
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
vi.mock("../../../../src/core/maps/Maps");
vi.mock("../../../../src/core/utils/ItemUtils");

describe("DrinkCommand", () => {
	const player = {
		id: 42,
		keycloakId: "player-keycloak-id",
		effectRemainingTime: vi.fn()
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

	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(InventorySlots.getOfPlayer).mockResolvedValue([timePotionSlot as never]);
		vi.mocked(toItemWithDetails).mockReturnValue({ id: 1 } as never);
		player.effectRemainingTime.mockReturnValue(0);
	});

	async function executeCommand(): Promise<unknown[]> {
		const response: unknown[] = [];
		await new DrinkCommand().execute(response as never, player as never, {} as never, {} as never);
		return response;
	}

	it("offers time potions during a normal journey without an active effect", async () => {
		vi.mocked(Maps.isArrived).mockReturnValue(false);

		const response = await executeCommand();

		expect(response[0]?.constructor.name).toBe("ReactionCollectorCreationPacket");
	});

	it("offers time potions while an effect is active", async () => {
		vi.mocked(Maps.isArrived).mockReturnValue(true);
		player.effectRemainingTime.mockReturnValue(1);

		const response = await executeCommand();

		expect(response[0]?.constructor.name).toBe("ReactionCollectorCreationPacket");
	});

	it("hides time potions after arrival without an active effect", async () => {
		vi.mocked(Maps.isArrived).mockReturnValue(true);

		const response = await executeCommand();

		expect(response[0]?.constructor.name).toBe("CommandDrinkNoAvailablePotion");
	});
});
