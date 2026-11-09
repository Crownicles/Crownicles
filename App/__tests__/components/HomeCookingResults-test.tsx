import {
	render, screen
} from "@testing-library/react-native";
import {
	CookingOutputType, CraftResult
} from "ws-packets/src/objects/Cooking";
import { HomeCookingResults } from "@/src/components/HomeCookingResults";

jest.mock("@/src/translations/i18n", () => ({ i18n: { t: (key: string, options?: object): string => options ? `${key} ${JSON.stringify(options)}` : key } }));

function crafted(values: Partial<CraftResult>): CraftResult {
	return {
		success: true,
		recipeId: "potion_health_1",
		wasSecret: false,
		outputType: CookingOutputType.POTION,
		cookingXpGained: 40,
		cookingLevelUp: false,
		menu: {
			cookingLevel: 100,
			cookingGrade: "masterChef",
			currentSlots: [],
			isIgnited: true,
			rules: {
				specialtyStation: 5, specialtyLimit: 3, timePotionsShownFrom: 10
			}
		},
		...values
	};
}

describe("cooking results", () => {
	it("tells the master chef badge earned with the dish", async () => {
		await render(<HomeCookingResults outcome={{
			kind: "crafted", result: crafted({ masterChefBadgeEarned: true })
		}} />);

		expect(screen.getByText("app:cooking.badge {\"badge\":\"app:reference.badges.names.master_chef\"}")).toBeTruthy();
	});

	it("says nothing of a badge for an ordinary dish", async () => {
		await render(<HomeCookingResults outcome={{
			kind: "crafted", result: crafted({})
		}} />);

		expect(screen.queryByText(/app:cooking\.badge/u)).toBeNull();
	});
});
