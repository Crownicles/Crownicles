import { ReactNode } from "react";
import {
	render, screen
} from "@testing-library/react-native";
import {
	QueryClient, QueryClientProvider
} from "@tanstack/react-query";
import { GuildFoodShop } from "ws-packets/src/objects/GuildDomain";
import { CitySubmenuView } from "@/src/collectors/CitySubmenuView";
import {
	groupCityEntries, submenuTitle
} from "@/src/collectors/CityMenuModel";
import { CITY_DATA_KINDS } from "ws-packets/src/fromServer/collectors";

jest.mock("expo-router", () => ({
	useFocusEffect: jest.fn(),
	useRouter: (): object => ({
		push: jest.fn(), navigate: jest.fn()
	})
}));
jest.mock("@/src/AppIcons", () => ({ AppIcons: {
	getIcon: (): string => "", getIconOrNull: (): null => null
} }));
jest.mock("@/src/translations/i18n", () => ({ i18n: { t: (key: string): string => key } }));
jest.mock("@/src/collectors/CollectorsContext", () => ({ useCollectors: (): object => ({
	open: [], react: jest.fn(), isAnswerPending: (): boolean => false, track: jest.fn(), answerWithoutShowing: jest.fn()
}) }));
const mockDomainState = jest.fn();
jest.mock("@/src/store/useGameQuery", () => ({ useGameQuery: (): unknown => mockDomainState() }));

const SHOP: GuildFoodShop = {
	guildName: "Aurore",
	playerMoney: 2000,
	treasury: 50_000,
	food: {
		common: 0, carnivorous: 0, herbivorous: 0, ultimate: 0
	},
	foodCaps: [
		150,
		90,
		90,
		30
	],
	maxBuyableFood: [
		10,
		2,
		2,
		1
	],
	foodPrices: [
		20,
		250,
		250,
		600
	],
	maxFoodCosts: [
		200,
		500,
		500,
		600
	],
	canUseShop: true
};

function renderSubmenu(): Promise<unknown> {
	const client = new QueryClient();
	const wrapper = ({ children }: { children: ReactNode }): ReactNode => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
	return render(<CitySubmenuView
		view="guildFoodShop"
		entries={[]}
		collector={{
			data: {
				type: CITY_DATA_KINDS.CITY,
				data: {
					mapTypeId: "ci", mapLocationId: 10, availableServices: []
				}
			},
			reactions: []
		}}
		onChoose={jest.fn()}
		onNavigate={jest.fn()}
		onBack={jest.fn()}
		locked={false}
	/>, { wrapper });
}

describe("guild food supply away from the domain", () => {
	it("leads from the city to a page of its own rather than to the whole domain", () => {
		const model = groupCityEntries([], { guildFoodShop: SHOP });
		expect(model.groups.guild).toEqual([
			expect.objectContaining({
				kind: "navigation", key: "guild-food-shop", view: "guildFoodShop", title: "commands:report.city.guildFoodShop.label", subtitle: "app:guildDomain.foodShopDescription"
			})
		]);
		expect(submenuTitle("guildFoodShop").title).toBe("commands:report.city.guildFoodShop.label");
	});

	it("only shows the treasury and the foods for sale, none of the domain's greyed buildings", async () => {
		mockDomainState.mockReturnValue({
			status: "ready",
			data: { data: {
				...SHOP, isInCity: false, domainCityId: "elsewhere"
			} }
		});
		await renderSubmenu();
		expect(screen.getByText("commands:report.city.guildFoodShop.label")).toBeTruthy();
		expect(screen.getByText("app:city.summary.treasury")).toBeTruthy();
		expect(screen.getAllByText("app:guildDomain.buyFood").length).toBeGreaterThan(0);
		expect(screen.queryByText("app:guildDomain.buildings")).toBeNull();
		expect(screen.queryByText("app:guildDomain.deposit")).toBeNull();
		expect(screen.queryByTestId("domain-standing")).toBeNull();
	});
});
