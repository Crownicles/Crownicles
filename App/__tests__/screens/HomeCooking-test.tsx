import {fireEvent, render, screen, waitFor} from "@testing-library/react-native";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {ReactNode} from "react";
import {HomeCooking} from "@/src/components/HomeCooking";
import {GameClient} from "@/src/networking/GameClient";
import {GAME_ENTITIES, gameKey} from "@/src/store/GameEntities";
import {CookingRes} from "ws-packets/src/fromServer/home/CookingRes";
import {CookingMenu, CookingOutcome, CookingOutputType, RecipeType} from "ws-packets/src/objects/Cooking";
import {CookingWoodConfirmReq} from "ws-packets/src/fromClient/CookingReq";

jest.mock("expo-router", () => ({useFocusEffect: jest.fn()}));
jest.mock("@/src/networking/GameClient", () => ({GameClient: {request: jest.fn()}}));
jest.mock("@/src/AppIcons", () => ({AppIcons: {getIcon: (): string => "", getIconOrNull: (): null => null}}));
jest.mock("@/src/translations/i18n", () => ({i18n: {t: (key: string, options?: {owned?: number; required?: number; level?: number; grade?: string}): string => {
	if (key === "app:cooking.ingredientQuantity") return `${options?.owned}/${options?.required}`;
	if (key === "app:cooking.levelUp") return `${options?.level} - ${options?.grade}`;
	return key;
}}}));

function menu(): CookingMenu {
	return {cookingLevel: 7, cookingGrade: "kitchenHelper", isIgnited: true, currentSlots: [{slotIndex: 2, recipe: {id: "potion_health_1", level: 1, isSecret: false, outputDescription: "", outputType: CookingOutputType.POTION, recipeType: RecipeType.POTION_HEALTH, ingredients: {plants: [{plantId: 1, quantity: 2, playerHas: 4}], materials: []}, canCraft: true}}]};
}
function answer(outcome: CookingOutcome): {kind: "answer"; packet: CookingRes} {
	return {kind: "answer", packet: Object.assign(new CookingRes(), {outcome})};
}
function provider(initial: CookingMenu): (props: {children: ReactNode}) => ReactNode {
	const client = new QueryClient({defaultOptions: {queries: {retry: false, gcTime: Infinity, staleTime: Infinity}}});
	client.setQueryData(gameKey(GAME_ENTITIES.COOKING), answer({kind: "menu", menu: initial}));
	return function Wrapper({children}: {children: ReactNode}): ReactNode {
		return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
	};
}

describe("cooking screen", () => {
	beforeEach(() => jest.clearAllMocks());
	it("renders server ingredient amounts and respects disabled recipes", async () => {
		const initial = menu();
		initial.currentSlots[0].recipe!.canCraft = false;
		await render(<HomeCooking />, {wrapper: provider(initial)});
		await fireEvent.press(screen.getByText("models:cooking.recipes.potion_health_1"));
		expect(screen.getByText("4/2")).toBeTruthy();
		await fireEvent.press(screen.getByText("app:cooking.craft"));
		expect(GameClient.request).not.toHaveBeenCalled();
	});
	it("binds confirmation to the displayed recipe and updates stale menus after a refusal", async () => {
		const updated = menu();
		updated.currentSlots[0].recipe!.id = "potion_energy_1";
		jest.mocked(GameClient.request).mockResolvedValue(answer({kind: "crafted", result: {success: false, recipeId: "potion_energy_1", wasSecret: false, outputType: CookingOutputType.POTION, error: "craftUnavailable", cookingXpGained: 0, cookingLevelUp: false, menu: updated}}));
		await render(<HomeCooking />, {wrapper: provider(menu())});
		await fireEvent.press(screen.getByText("models:cooking.recipes.potion_health_1"));
		expect(GameClient.request).not.toHaveBeenCalled();
		await fireEvent.press(screen.getByText("app:cooking.craft"));
		await waitFor(() => expect(screen.getByText("app:cooking.errors.craftUnavailable")).toBeTruthy());
		expect(jest.mocked(GameClient.request).mock.calls[0][0]).toMatchObject({slotIndex: 2, recipeId: "potion_health_1"});
		expect(screen.getByText("models:cooking.recipes.potion_energy_1")).toBeTruthy();
	});
	it("requires explicit consent for rare wood and sends a refusal when cancelled", async () => {
		const initial = {...menu(), isIgnited: false, currentSlots: []};
		jest.mocked(GameClient.request).mockResolvedValueOnce(answer({kind: "woodConfirmation", woodMaterialId: 9, woodRarity: 3})).mockResolvedValueOnce(answer({kind: "menu", menu: initial}));
		await render(<HomeCooking />, {wrapper: provider(initial)});
		await fireEvent.press(screen.getByText("app:cooking.ignite"));
		await waitFor(() => expect(screen.getByText("app:cooking.rareWood")).toBeTruthy());
		expect(GameClient.request).toHaveBeenCalledTimes(1);
		await fireEvent.press(screen.getByText("app:collector.refuse"));
		await waitFor(() => expect(GameClient.request).toHaveBeenCalledTimes(2));
		expect(jest.mocked(GameClient.request).mock.calls[1][0]).toBeInstanceOf(CookingWoodConfirmReq);
		expect(jest.mocked(GameClient.request).mock.calls[1][0]).toMatchObject({accepted: false});
	});
	it("keeps the furnace state after a no-wood refusal", async () => {
		jest.mocked(GameClient.request).mockResolvedValue(answer({kind: "noWood"}));
		await render(<HomeCooking />, {wrapper: provider(menu())});
		await fireEvent.press(screen.getByText("app:cooking.confirmRevive"));
		await fireEvent.press(screen.getAllByText("app:cooking.revive").at(-1)!);
		await waitFor(() => expect(screen.getByText("app:cooking.noWood")).toBeTruthy());
		expect(screen.getByText("models:cooking.recipes.potion_health_1")).toBeTruthy();
		expect(screen.getByText("app:cooking.lit")).toBeTruthy();
	});
	it("displays the actual material output and granted cooking experience", async () => {
		jest.mocked(GameClient.request).mockResolvedValue(answer({kind: "crafted", result: {success: true, recipeId: "material_1", wasSecret: false, outputType: CookingOutputType.MATERIAL, material: {materialId: 9, quantity: 5}, cookingXpGained: 17, cookingLevelUp: true, menu: menu()}}));
		await render(<HomeCooking />, {wrapper: provider(menu())});
		await fireEvent.press(screen.getByText("models:cooking.recipes.potion_health_1"));
		await fireEvent.press(screen.getByText("app:cooking.craft"));
		await waitFor(() => expect(screen.getByText("app:cooking.success")).toBeTruthy());
		expect(screen.getByText("models:materials.9")).toBeTruthy();
		expect(screen.getByText("5")).toBeTruthy();
		expect(screen.getByText("17")).toBeTruthy();
		expect(screen.getByText("7 - models:cooking.grades.kitchenHelper")).toBeTruthy();
	});
});