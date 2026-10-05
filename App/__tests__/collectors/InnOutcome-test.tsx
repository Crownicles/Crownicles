import {act, fireEvent, render, screen} from "@testing-library/react-native";
import {INN_OUTCOMES, InnOutcome as Outcome, InnRes} from "ws-packets/src/fromServer/report/InnRes";
import {InnOutcome} from "@/src/collectors/InnOutcome";

jest.mock("@/src/AppIcons", () => ({AppIcons: {getIcon: (): string => "", getIconOrNull: (): null => null}}));
jest.mock("@/src/translations/i18n", () => ({i18n: {t: (key: string, options?: object): string => options ? `${key} ${JSON.stringify(options)}` : key}}));

function served(outcome: Outcome): InnRes {
	return Object.assign(new InnRes(), {outcome});
}

describe("inn outcome", () => {
	it("acknowledges a meal with the energy it gave", async () => {
		await render(<InnOutcome outcome={served({type: INN_OUTCOMES.MEAL, energy: 40, moneySpent: 20})} onContinue={jest.fn()} />);
		expect(screen.getByText("app:city.inn.meal")).toBeTruthy();
		expect(screen.getByText("app:inventoryActions.gain {\"amount\":\"40\"}")).toBeTruthy();
	});

	it("names the room slept in and the health it gave", async () => {
		await render(<InnOutcome outcome={served({type: INN_OUTCOMES.ROOM, roomId: "suite", health: 60, moneySpent: 50})} onContinue={jest.fn()} />);
		expect(screen.getByText("app:city.inn.room")).toBeTruthy();
		expect(screen.getByText(/^app:city\.inn\.roomDetails .*commands:report\.city\.inns\.rooms\.suite/)).toBeTruthy();
		expect(screen.getByText("app:inventoryActions.gain {\"amount\":\"60\"}")).toBeTruthy();
	});

	it("tells a refused meal when it is served again, and goes away when tapped", async () => {
		const onContinue = jest.fn();
		await render(<InnOutcome outcome={served({type: INN_OUTCOMES.MEAL_COOLDOWN, nextAvailableAt: Date.now() + 3_600_000})} onContinue={onContinue} />);
		expect(screen.getByText("app:city.inn.mealCooldown")).toBeTruthy();
		expect(screen.getByText(/^app:city\.inn\.availableIn /)).toBeTruthy();
		await act(async () => {
			await fireEvent.press(screen.getByText("app:city.inn.mealCooldown"));
		});
		expect(onContinue).toHaveBeenCalled();
	});
});
