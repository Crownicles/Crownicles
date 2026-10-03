import {fireEvent, render, screen} from "@testing-library/react-native";
import {HOME_PURCHASES, HomePurchaseRes} from "ws-packets/src/fromServer/home/HomePurchaseRes";
import {HomePurchaseOutcome} from "@/src/collectors/HomePurchaseOutcome";

jest.mock("@/src/AppIcons", () => ({AppIcons: {getIcon: (): string => "", getIconOrNull: (): null => null}}));
jest.mock("@/src/translations/i18n", () => ({i18n: {t: (key: string, options?: object): string => options ? `${key} ${JSON.stringify(options)}` : key}}));

function purchase(data: Omit<HomePurchaseRes, "wireName">): HomePurchaseRes {
	return Object.assign(new HomePurchaseRes(), data);
}

describe("home purchase celebration", () => {
	it("names the level the home reached", async () => {
		await render(<HomePurchaseOutcome outcome={purchase({purchase: HOME_PURCHASES.UPGRADE, cost: 9000, homeLevel: 4})} onContinue={jest.fn()} />);
		expect(screen.getByTestId("home-purchased")).toBeTruthy();
		expect(screen.getByText("app:city.purchases.upgrade")).toBeTruthy();
		expect(screen.getByText("app:city.purchases.homeLevel {\"level\":4}")).toBeTruthy();
	});

	it("names where a new apartment stands, and lets the player move on", async () => {
		const onContinue = jest.fn();
		await render(<HomePurchaseOutcome outcome={purchase({purchase: HOME_PURCHASES.APARTMENT, cost: 12000, mapLocationId: 23})} onContinue={onContinue} />);
		expect(screen.getByText("app:city.purchases.apartment")).toBeTruthy();
		expect(screen.getByText("models:map_locations.23.name")).toBeTruthy();
		await fireEvent.press(screen.getByText("app:common.continue"));
		expect(onContinue).toHaveBeenCalled();
	});

	it("announces the apartments with a first home, when they become buyable", async () => {
		await render(<HomePurchaseOutcome outcome={purchase({purchase: HOME_PURCHASES.HOME, cost: 1000, homeLevel: 1})} onContinue={jest.fn()} />);
		expect(screen.getByText("app:city.firstHome.apartments.title")).toBeTruthy();
	});

	it("tells what a foothold opens, and what a let apartment earns", async () => {
		const view = await render(<HomePurchaseOutcome outcome={purchase({purchase: HOME_PURCHASES.APARTMENT, cost: 12000, mapLocationId: 23, isRented: false})} onContinue={jest.fn()} />);
		expect(screen.getByText(/app:city\.apartmentBenefits\.chest\.title/)).toBeTruthy();
		expect(screen.queryByText(/app:city\.apartmentBenefits\.rent\.title/)).toBeNull();

		await view.rerender(<HomePurchaseOutcome outcome={purchase({purchase: HOME_PURCHASES.APARTMENT, cost: 12000, mapLocationId: 23, isRented: true})} onContinue={jest.fn()} />);
		expect(screen.getByText("app:city.purchases.apartmentRented")).toBeTruthy();
		expect(screen.getByText(/app:city\.apartmentBenefits\.rent\.title/)).toBeTruthy();
		expect(screen.queryByText(/app:city\.apartmentBenefits\.chest\.title/)).toBeNull();
	});
});
