import {
	afterEach, beforeEach, describe, expect, it, vi
} from "vitest";
import {
	Sequelize, Transaction
} from "sequelize";
import InventoryInfo, {
	initModel as initInventoryInfo, InventoryInfos
} from "../../../../src/core/database/game/models/InventoryInfo";
import {
	ScheduledDailyBonusNotification, ScheduledDailyBonusNotifications
} from "../../../../src/core/database/game/models/ScheduledDailyBonusNotification";
import Player, { Players } from "../../../../src/core/database/game/models/Player";
import { ItemCategory } from "../../../../../Lib/src/constants/ItemConstants";
import { CrowniclesLogger } from "../../../../../Lib/src/logs/CrowniclesLogger";

const sequelize = new Sequelize({
	dialect: "mariadb", logging: false
});
initInventoryInfo(sequelize);

const HOUR_MS = 3_600_000;
const NOW = new Date(2026, 2, 10, 12, 0, 0);

/**
 * Build an unsaved inventory info with one slot of each category
 */
function buildInfo(values: Record<string, unknown> = {}): InventoryInfo {
	return InventoryInfo.build({
		playerId: 7,
		weaponSlots: 1,
		armorSlots: 2,
		potionSlots: 3,
		objectSlots: 4,
		...values
	});
}

/**
 * Run the hooks of the model registered for the given event
 */
function runHooks(hook: string, ...args: unknown[]): Promise<void> {
	// runHooks exists on every model but is missing from the Sequelize typings
	return (InventoryInfo as unknown as { runHooks: (hook: string, ...args: unknown[]) => Promise<void> }).runHooks(hook, ...args);
}

describe("InventoryInfo", () => {
	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it.each([
		[ItemCategory.WEAPON, 1],
		[ItemCategory.ARMOR, 2],
		[ItemCategory.POTION, 3],
		[ItemCategory.OBJECT, 4],
		[9 as ItemCategory, 0]
	])("should give the slot limit of the category %s", (category, limit) => {
		expect(buildInfo().slotLimitForCategory(category)).toBe(limit);
	});

	it.each([
		[ItemCategory.WEAPON, [2, 2, 3, 4]],
		[ItemCategory.ARMOR, [1, 3, 3, 4]],
		[ItemCategory.POTION, [1, 2, 4, 4]],
		[ItemCategory.OBJECT, [1, 2, 3, 5]],
		[9 as ItemCategory, [1, 2, 3, 4]]
	])("should only add a slot to the category %s", (category, expected) => {
		const info = buildInfo();

		info.addSlotForCategory(category);

		expect([info.weaponSlots, info.armorSlots, info.potionSlots, info.objectSlots]).toEqual(expected);
	});

	it("should identify the inventory info by its player when saving it", () => {
		expect(buildInfo().where()).toEqual({ playerId: 7 });
	});

	it("should give 0 as last daily timestamp when the player never took a daily", () => {
		expect(buildInfo({ lastDailyAt: null }).getLastDailyAtTimestamp()).toBe(0);
	});

	it("should give the timestamp of the last daily", () => {
		expect(buildInfo({ lastDailyAt: NOW }).getLastDailyAtTimestamp()).toBe(NOW.valueOf());
	});

	it("should set the last daily date to now", () => {
		vi.useFakeTimers({ now: NOW });
		const info = buildInfo({ lastDailyAt: null });

		info.updateLastDailyAt();

		expect(info.lastDailyAt).toEqual(NOW);
	});

	it("should refresh the update date before every save", async () => {
		vi.useFakeTimers({ now: NOW });
		const info = buildInfo();
		info.updatedAt = new Date(2020, 0, 1);

		await runHooks("beforeSave", info, {});

		expect(info.updatedAt).toEqual(NOW);
	});

	describe("daily bonus notification after save", () => {
		const pending = { id: 1 } as ScheduledDailyBonusNotification;

		beforeEach(() => {
			vi.useFakeTimers({
				now: NOW, toFake: ["Date"]
			});
			vi.spyOn(ScheduledDailyBonusNotifications, "getPendingNotification").mockResolvedValue(null);
			vi.spyOn(ScheduledDailyBonusNotifications, "bulkDelete").mockResolvedValue(undefined);
			vi.spyOn(ScheduledDailyBonusNotifications, "scheduleNotification").mockResolvedValue(undefined);
			vi.spyOn(Players, "getById").mockResolvedValue({ keycloakId: "kc7" } as Player);
		});

		it("should replace the pending notification by one when the next daily is available", async () => {
			vi.mocked(ScheduledDailyBonusNotifications.getPendingNotification).mockResolvedValue(pending);
			const lastDailyAt = new Date(NOW.getTime() - 2 * HOUR_MS);

			await runHooks("afterSave", buildInfo({ lastDailyAt }), { transaction: null });

			await vi.waitFor(() => expect(ScheduledDailyBonusNotifications.scheduleNotification).toHaveBeenCalled());
			expect(ScheduledDailyBonusNotifications.getPendingNotification).toHaveBeenCalledWith(7);
			expect(ScheduledDailyBonusNotifications.bulkDelete).toHaveBeenCalledWith([pending]);
			expect(ScheduledDailyBonusNotifications.scheduleNotification)
				.toHaveBeenCalledWith(7, "kc7", new Date(lastDailyAt.getTime() + 22 * HOUR_MS));
		});

		it("should not schedule a notification when the daily is already available", async () => {
			await runHooks("afterSave", buildInfo({ lastDailyAt: new Date(NOW.getTime() - 22 * HOUR_MS) }), { transaction: null });

			await vi.waitFor(() => expect(Players.getById).toHaveBeenCalledWith(7));
			expect(ScheduledDailyBonusNotifications.bulkDelete).not.toHaveBeenCalled();
			expect(ScheduledDailyBonusNotifications.scheduleNotification).not.toHaveBeenCalled();
		});

		it("should wait for the commit of the saving transaction", async () => {
			const afterCommit = vi.fn();
			const transaction = { afterCommit } as unknown as Transaction; // Only the commit hook is used

			await runHooks("afterSave", buildInfo({ lastDailyAt: new Date(NOW.getTime() - HOUR_MS) }), { transaction });

			expect(ScheduledDailyBonusNotifications.getPendingNotification).not.toHaveBeenCalled();
			afterCommit.mock.calls[0][0]();
			await vi.waitFor(() => expect(ScheduledDailyBonusNotifications.scheduleNotification).toHaveBeenCalled());
		});

		it("should log a failure of the notification update", async () => {
			vi.mocked(ScheduledDailyBonusNotifications.getPendingNotification).mockRejectedValue(new Error("db down"));
			const errorLog = vi.spyOn(CrowniclesLogger, "errorWithObj").mockImplementation(() => undefined);

			await runHooks("afterSave", buildInfo({ lastDailyAt: NOW }), { transaction: null });

			await vi.waitFor(() => expect(errorLog).toHaveBeenCalledWith("Error while handling notifications", expect.any(Error)));
		});
	});
});

describe("InventoryInfos", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("should find or create the inventory info of the player", async () => {
		const info = buildInfo();
		const findOrCreate = vi.spyOn(InventoryInfo, "findOrCreate").mockResolvedValue([info, false]);

		expect(await InventoryInfos.getOfPlayer(7)).toBe(info);
		expect(findOrCreate).toHaveBeenCalledWith({ where: { playerId: 7 } });
	});
});
