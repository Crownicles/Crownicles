import {act, fireEvent, render, screen} from "@testing-library/react-native";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {DAILY_BONUS_DATA_KINDS, DAILY_BONUS_REACTION_KINDS, GENERIC_REACTION_KINDS} from "ws-packets/src/fromServer/collectors";
import {ItemNature} from "ws-packets/src/objects/ItemNature";
import {ConsumableCollector} from "@/src/collectors/ConsumableCollector";
import {InventoryOutcome} from "@/src/collectors/InventoryOutcome";

jest.mock("@/src/AppIcons", () => ({AppIcons: {getIconOrNull: (): null => null, getIcon: (): string => ""}}));
jest.mock("@/src/translations/i18n", () => ({i18n: {t: (key: string, options?: object): string => `${key}${options ? ` ${JSON.stringify(options)}` : ""}`}}));

describe("daily bonus and potion outcomes", () => {
	it("offers the server object without shifting its reaction index", async () => {
		const collector: ReactionCollectorCreation = {id: "daily", endTime: Date.now() + 60_000, data: {type: DAILY_BONUS_DATA_KINDS.COLLECTOR, data: {}}, reactions: [
			{type: "unknown", data: {serverType: "future"}},
			{type: DAILY_BONUS_REACTION_KINDS.OBJECT, data: {object: {id: 3, itemCategory: 3, rarity: 1, nature: ItemNature.TIME_SPEEDUP, power: 90, maxPower: 90}}},
			{type: DAILY_BONUS_REACTION_KINDS.OBJECT, data: {object: {id: 3, itemCategory: 3, rarity: 1, nature: ItemNature.TIME_SPEEDUP, power: 90, maxPower: 90}}},
			{type: GENERIC_REACTION_KINDS.REFUSE, data: {}}
		]};
		const choose = jest.fn();
		await render(<ConsumableCollector collector={collector} onChoose={choose} submitting={false} />);
		expect(screen.getAllByText("models:objects.3")).toHaveLength(2);
		await fireEvent.press(screen.getAllByRole("button", {name: "models:objects.3"})[1]);
		await fireEvent.press(screen.getByRole("button", {name: "app:dailyBonus.claim"}));
		expect(choose).toHaveBeenCalledTimes(1);
		expect(choose).toHaveBeenCalledWith(2);
	});

	it("says how long the daily bonus still recharges", async () => {
		jest.useFakeTimers();
		try {
			jest.setSystemTime(1_900_000_000_000);
			await render(<InventoryOutcome outcome={{kind: "cooldown", packet: {cooldownHours: 2, lastDailyTimestamp: Date.now() - 3_600_000}}} onContinue={jest.fn()} />);
			expect(screen.getByText(/duration.hours .*count.*1/)).toBeTruthy();
		}
		finally {
			jest.useRealTimers();
		}
	});

	it("announces the gained effect in a toast the player can send away", async () => {
		const close = jest.fn();
		await render(<InventoryOutcome outcome={{kind: "daily", packet: {itemNature: ItemNature.HEALTH, value: 25}}} onContinue={close} />);
		expect(screen.getByText(/potionsNaturesWithoutEmote.1.*25/)).toBeTruthy();
		expect(screen.getByText(/inventoryActions.gain.*25/)).toBeTruthy();
		await fireEvent.press(screen.getByRole("alert"));
		expect(close).toHaveBeenCalledTimes(1);
	});

	it("lets the toast leave by itself", async () => {
		jest.useFakeTimers();
		try {
			const close = jest.fn();
			await render(<InventoryOutcome outcome={{kind: "drink", packet: {itemNature: ItemNature.ENERGY, value: 40}}} onContinue={close} />);
			expect(close).not.toHaveBeenCalled();
			await act(async () => { await jest.advanceTimersByTimeAsync(4_000); });
			expect(close).toHaveBeenCalledTimes(1);
		}
		finally {
			jest.useRealTimers();
		}
	});
});
