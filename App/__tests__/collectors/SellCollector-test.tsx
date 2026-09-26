import {fireEvent, render, screen} from "@testing-library/react-native";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {GENERIC_REACTION_KINDS, SELL_DATA_KINDS, SELL_REACTION_KINDS} from "ws-packets/src/fromServer/collectors";
import {SellCollector} from "@/src/collectors/SellCollector";
import {InventoryOutcome} from "@/src/collectors/InventoryOutcome";

jest.mock("@/src/translations/i18n", () => ({i18n: {t: (key: string, options?: {amount?: string}): string => options?.amount ? `${key}:${options.amount}` : key}}));
jest.mock("@/src/AppIcons", () => ({AppIcons: {getIconOrNull: (): null => null, getIcon: (): string => ""}}));
jest.mock("@/src/store/usePlayerProfile", () => ({usePlayerProfile: (): object => ({status: "ready", data: {pseudo: "Drapht"}})}));

function collector(): ReactionCollectorCreation {
	return {id: "sale", endTime: Date.now() + 60_000, data: {type: SELL_DATA_KINDS.COLLECTOR, data: {}}, reactions: [
		{type: "unknown", data: {serverType: "future"}},
		{type: SELL_REACTION_KINDS.ITEM, data: {item: {id: 7, category: 0}, slot: 3, price: 120}},
		{type: SELL_REACTION_KINDS.ITEM, data: {item: {id: 43, category: 2}, slot: 1, price: 0}},
		{type: GENERIC_REACTION_KINDS.REFUSE, data: {}}
	]};
}

describe("sale confirmation", () => {
	it("confirms the original index instead of the filtered position", async () => {
		const choose = jest.fn();
		await render(<SellCollector collector={collector()} onChoose={choose} submitting={false} />);
		await fireEvent.press(screen.getByText("models:weapons.7"));
		expect(choose).not.toHaveBeenCalled();
		await fireEvent.press(screen.getByText("app:sale.confirmSell"));
		expect(choose).toHaveBeenCalledTimes(1);
		expect(choose).toHaveBeenCalledWith(1);
	});

	it("offers a discard confirmation when Core proposes no payment", async () => {
		const choose = jest.fn();
		await render(<SellCollector collector={collector()} onChoose={choose} submitting={false} />);
		await fireEvent.press(screen.getByText("models:potions.43"));
		expect(screen.getByText("app:sale.confirmDiscard")).toBeTruthy();
		await fireEvent.press(screen.getByText("models:potions.43"));
		expect(screen.queryByText("app:sale.confirmDiscard")).toBeNull();
		expect(choose).not.toHaveBeenCalled();
	});

	it("closes without a sale using the original refusal index", async () => {
		const choose = jest.fn();
		await render(<SellCollector collector={collector()} onChoose={choose} submitting={false} />);
		await fireEvent.press(screen.getByLabelText("app:common.back"));
		expect(choose).toHaveBeenCalledTimes(1);
		expect(choose).toHaveBeenCalledWith(3);
	});

	it("announces the actual credited amount in a toast", async () => {
		const onContinue = jest.fn();
		await render(<InventoryOutcome outcome={{kind: "sale", packet: {item: {id: 7, category: 0}, price: 132}}} onContinue={onContinue} />);
		expect(screen.getByText("commands:sell.soldMessageTitle")).toBeTruthy();
		expect(screen.getByText("app:inventoryActions.gain:132")).toBeTruthy();
		await fireEvent.press(screen.getByRole("alert"));
		expect(onContinue).toHaveBeenCalledTimes(1);
	});

	it("can be left with the edge gesture, like any other page of the app", async () => {
		const choose = jest.fn();
		await render(<SellCollector collector={collector()} onChoose={choose} submitting={false} />);
		expect(screen.getByTestId("swipe-back")).toBeTruthy();
	});
});

describe("item left behind after a find", () => {
	it("announces the money received for the replaced equipment", async () => {
		await render(<InventoryOutcome outcome={{kind: "refused", packet: {item: {id: 7, category: 0}, autoSell: false, soldMoney: 132}}} onContinue={jest.fn()} />);
		expect(screen.getByText("commands:sell.soldMessageTitle")).toBeTruthy();
		expect(screen.getByText("models:weapons.7")).toBeTruthy();
		expect(screen.getByText("app:inventoryActions.gain:132")).toBeTruthy();
	});

	it("says the find was already owned when Core sold it automatically", async () => {
		await render(<InventoryOutcome outcome={{kind: "refused", packet: {item: {id: 7, category: 0}, autoSell: true, soldMoney: 40}}} onContinue={jest.fn()} />);
		expect(screen.getByText("commands:sell.soldMessageAlreadyOwnTitle")).toBeTruthy();
		expect(screen.getByText("app:inventoryActions.gain:40")).toBeTruthy();
	});

	it("announces a destroyed potion without any gain", async () => {
		await render(<InventoryOutcome outcome={{kind: "refused", packet: {item: {id: 43, category: 2}, autoSell: false, soldMoney: 0}}} onContinue={jest.fn()} />);
		expect(screen.getByText("commands:sell.potionDestroyedTitle")).toBeTruthy();
		expect(screen.queryByText(/inventoryActions.gain/)).toBeNull();
	});
});
