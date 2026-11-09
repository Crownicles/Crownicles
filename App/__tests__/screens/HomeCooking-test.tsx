import {
	fireEvent, render, screen, waitFor
} from "@testing-library/react-native";
import {
	QueryClient, QueryClientProvider
} from "@tanstack/react-query";
import { ReactNode } from "react";
import { HomeCooking } from "@/src/components/HomeCooking";
import { GameClient } from "@/src/networking/GameClient";
import {
	GAME_ENTITIES, gameKey
} from "@/src/store/GameEntities";
import { CookingRes } from "ws-packets/src/fromServer/home/CookingRes";
import {
	CookingMenu, CookingOutcome, CookingOutputType, CookingSlot, CookingSpecialtyErrors, RecipeType
} from "ws-packets/src/objects/Cooking";
import {
	CookingRemoveSpecialtyReq, CookingSetSpecialtyReq, CookingWoodConfirmReq
} from "ws-packets/src/fromClient/CookingReq";

jest.mock("expo-router", () => ({ useFocusEffect: jest.fn() }));
jest.mock("@/src/networking/GameClient", () => ({ GameClient: { request: jest.fn() } }));
jest.mock("@/src/AppIcons", () => ({ AppIcons: {
	getIcon: (): string => "", getIconOrNull: (): null => null
} }));
jest.mock("@/src/translations/i18n", () => ({ i18n: { t: (key: string, options?: {
	owned?: number; required?: number; level?: number; grade?: string;
}): string => {
	if (key === "app:cooking.ingredientQuantity") {
		return `${options?.owned}/${options?.required}`;
	}
	if (key === "app:cooking.levelUp") {
		return `${options?.level} - ${options?.grade}`;
	}
	return key;
} } }));

const SPECIALTY_STATION = 5;

function menu(): CookingMenu {
	return {
		cookingLevel: 7,
		cookingGrade: "kitchenHelper",
		isIgnited: true,
		currentSlots: [
			{
				slotIndex: 2,
				recipe: {
					id: "potion_health_1",
					level: 1,
					isSecret: false,
					outputDescription: "",
					outputType: CookingOutputType.POTION,
					recipeType: RecipeType.POTION_HEALTH,
					ingredients: {
						plants: [
							{
								plantId: 1, quantity: 2, playerHas: 4
							}
						],
						materials: []
					},
					canCraft: true
				}
			}
		],
		rules: {
			specialtyStation: SPECIALTY_STATION, specialtyLimit: 0, nextSpecialtyLevel: 75, timePotionsShownFrom: 10
		}
	};
}

function timePotionSlot(slotIndex: number, recipeId: string, timePotionsLeftThisWeek: number): CookingSlot {
	return {
		slotIndex,
		recipe: {
			id: recipeId,
			level: 4,
			isSecret: false,
			outputDescription: "",
			outputType: CookingOutputType.POTION,
			recipeType: RecipeType.POTION_TIME_SPEEDUP,
			ingredients: {
				plants: [], materials: []
			},
			canCraft: timePotionsLeftThisWeek > 0,
			timePotionsLeftThisWeek
		}
	};
}

/** A master chef with two of their three specialties, the station offering the second one. */
function masterChefMenu(): CookingMenu {
	const initial = menu();
	return {
		...initial,
		cookingLevel: 80,
		specialties: [
			{
				recipeId: "potion_attack_3", level: 3, recipeType: RecipeType.POTION_ATTACK, canCraft: false
			},
			{
				recipeId: "potion_time_2", level: 4, recipeType: RecipeType.POTION_TIME_SPEEDUP, canCraft: true
			}
		],
		currentSlots: [...initial.currentSlots, timePotionSlot(SPECIALTY_STATION, "potion_time_2", 25)],
		rules: {
			...initial.rules, specialtyLimit: 3, nextSpecialtyLevel: 100
		}
	};
}
function answer(outcome: CookingOutcome): {
	kind: "answer"; packet: CookingRes;
} {
	return {
		kind: "answer", packet: Object.assign(new CookingRes(), { outcome })
	};
}
function provider(initial: CookingMenu): (props: { children: ReactNode }) => ReactNode {
	const client = new QueryClient({ defaultOptions: { queries: {
		retry: false, gcTime: Infinity, staleTime: Infinity
	} } });
	client.setQueryData(gameKey(GAME_ENTITIES.COOKING), answer({
		kind: "menu", menu: initial
	}));
	return function Wrapper({ children }: { children: ReactNode }): ReactNode {
		return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
	};
}

describe("cooking screen", () => {
	beforeEach(() => jest.clearAllMocks());
	it("renders server ingredient amounts and respects disabled recipes", async () => {
		const initial = menu();
		initial.currentSlots[0].recipe!.canCraft = false;
		await render(<HomeCooking />, { wrapper: provider(initial) });
		await fireEvent.press(screen.getByText("models:cooking.recipes.potion_health_1"));
		expect(screen.getByText("4/2")).toBeTruthy();
		await fireEvent.press(screen.getByText("app:cooking.craft"));
		expect(GameClient.request).not.toHaveBeenCalled();
	});
	it("names the missing ingredients as the reason a recipe is locked", async () => {
		const missing = menu();
		missing.currentSlots[0].recipe!.canCraft = false;
		missing.currentSlots[0].recipe!.ingredients.plants[0].playerHas = 1;
		await render(<HomeCooking />, { wrapper: provider(missing) });
		expect(screen.getByText("app:cooking.locks.missingIngredients")).toBeTruthy();
	});
	it("names the cold furnace before anything else", async () => {
		const cold = menu();
		cold.isIgnited = false;
		cold.currentSlots[0].recipe!.canCraft = false;
		await render(<HomeCooking />, { wrapper: provider(cold) });
		expect(screen.getByText("app:cooking.locks.unlit")).toBeTruthy();
	});
	it("binds confirmation to the displayed recipe and updates stale menus after a refusal", async () => {
		const updated = menu();
		updated.currentSlots[0].recipe!.id = "potion_energy_1";
		jest.mocked(GameClient.request).mockResolvedValue(answer({
			kind: "crafted",
			result: {
				success: false, recipeId: "potion_energy_1", wasSecret: false, outputType: CookingOutputType.POTION, error: "craftUnavailable", cookingXpGained: 0, cookingLevelUp: false, menu: updated
			}
		}));
		await render(<HomeCooking />, { wrapper: provider(menu()) });
		await fireEvent.press(screen.getByText("models:cooking.recipes.potion_health_1"));
		expect(GameClient.request).not.toHaveBeenCalled();
		await fireEvent.press(screen.getByText("app:cooking.craft"));
		await waitFor(() => expect(screen.getByText("app:cooking.errors.craftUnavailable")).toBeTruthy());
		expect(jest.mocked(GameClient.request).mock.calls[0][0]).toMatchObject({
			slotIndex: 2, recipeId: "potion_health_1"
		});
		expect(screen.getByText("models:cooking.recipes.potion_energy_1")).toBeTruthy();
	});
	it("requires explicit consent for rare wood and sends a refusal when cancelled", async () => {
		const initial = {
			...menu(), isIgnited: false, currentSlots: []
		};
		jest.mocked(GameClient.request).mockResolvedValueOnce(answer({
			kind: "woodConfirmation", woodMaterialId: 9, woodRarity: 3
		}))
			.mockResolvedValueOnce(answer({
				kind: "menu", menu: initial
			}));
		await render(<HomeCooking />, { wrapper: provider(initial) });
		await fireEvent.press(screen.getByText("app:cooking.ignite"));
		await waitFor(() => expect(screen.getByText("app:cooking.rareWood")).toBeTruthy());
		expect(GameClient.request).toHaveBeenCalledTimes(1);
		await fireEvent.press(screen.getByText("app:collector.refuse"));
		await waitFor(() => expect(GameClient.request).toHaveBeenCalledTimes(2));
		expect(jest.mocked(GameClient.request).mock.calls[1][0]).toBeInstanceOf(CookingWoodConfirmReq);
		expect(jest.mocked(GameClient.request).mock.calls[1][0]).toMatchObject({ accepted: false });
	});
	it("keeps the furnace state after a no-wood refusal", async () => {
		jest.mocked(GameClient.request).mockResolvedValue(answer({ kind: "noWood" }));
		await render(<HomeCooking />, { wrapper: provider(menu()) });
		await fireEvent.press(screen.getByText("app:cooking.confirmRevive"));
		await fireEvent.press(screen.getAllByText("app:cooking.revive").at(-1)!);
		await waitFor(() => expect(screen.getByText("app:cooking.noWood")).toBeTruthy());
		expect(screen.getByText("models:cooking.recipes.potion_health_1")).toBeTruthy();
		expect(screen.getByText("app:cooking.lit")).toBeTruthy();
	});
	it("displays the actual material output and granted cooking experience", async () => {
		jest.mocked(GameClient.request).mockResolvedValue(answer({
			kind: "crafted",
			result: {
				success: true,
				recipeId: "material_1",
				wasSecret: false,
				outputType: CookingOutputType.MATERIAL,
				material: {
					materialId: 9, quantity: 5
				},
				cookingXpGained: 17,
				cookingLevelUp: true,
				menu: menu()
			}
		}));
		await render(<HomeCooking />, { wrapper: provider(menu()) });
		await fireEvent.press(screen.getByText("models:cooking.recipes.potion_health_1"));
		await fireEvent.press(screen.getByText("app:cooking.craft"));
		await waitFor(() => expect(screen.getByText("app:cooking.success")).toBeTruthy());
		expect(screen.getByText("models:materials.9")).toBeTruthy();
		expect(screen.getByText("5")).toBeTruthy();
		expect(screen.getByText("17")).toBeTruthy();
		expect(screen.getByText("7 - models:cooking.grades.kitchenHelper")).toBeTruthy();
	});
	it("keeps the specialties out of sight until the cook's level unlocks them", async () => {
		await render(<HomeCooking />, { wrapper: provider(menu()) });
		await fireEvent.press(screen.getByText("models:cooking.recipes.potion_health_1"));
		expect(screen.getByText("app:cooking.pin")).toBeTruthy();
		expect(screen.queryByText("app:cooking.specialties.add")).toBeNull();
		expect(screen.queryByText("app:cooking.specialties.title")).toBeNull();
	});
	it("names the specialty station apart from the rotating ones and tells which specialty it offers", async () => {
		await render(<HomeCooking />, { wrapper: provider(masterChefMenu()) });
		expect(screen.getByText("models:cooking.stations.5")).toBeTruthy();
		expect(screen.getByText("app:cooking.specialties.rotation")).toBeTruthy();
		expect(screen.getByText("app:cooking.specialties.title")).toBeTruthy();
		expect(screen.getByText("models:cooking.recipes.potion_attack_3")).toBeTruthy();
		expect(screen.getAllByText("models:cooking.recipes.potion_time_2")).toHaveLength(2);
		expect(screen.getByText("app:cooking.specialties.ready")).toBeTruthy();
		expect(screen.getByText("app:cooking.specialties.nextUnlock")).toBeTruthy();
	});
	it("explains how many specialties the cook may keep before the first one is chosen", async () => {
		const unlocked = {
			...menu(),
			isIgnited: false,
			currentSlots: [],
			rules: {
				...menu().rules, specialtyLimit: 1
			}
		};
		await render(<HomeCooking />, { wrapper: provider(unlocked) });
		expect(screen.getByText("app:cooking.specialties.none")).toBeTruthy();
	});
	it("asks a cook whose furnace is already lit to choose the first specialty among its recipes, not to light it", async () => {
		const lit = {
			...menu(),
			rules: {
				...menu().rules, specialtyLimit: 1
			}
		};
		await render(<HomeCooking />, { wrapper: provider(lit) });
		expect(screen.getByText("app:cooking.specialties.noneLit")).toBeTruthy();
		expect(screen.queryByText("app:cooking.specialties.none")).toBeNull();
	});
	it("makes a rotating recipe a specialty with the station offering it, and tells where it will be offered", async () => {
		jest.mocked(GameClient.request).mockResolvedValue(answer({
			kind: "specialtyChosen", menu: masterChefMenu()
		}));
		await render(<HomeCooking />, { wrapper: provider(masterChefMenu()) });
		await fireEvent.press(screen.getByText("models:cooking.recipes.potion_health_1"));
		await fireEvent.press(screen.getByText("app:cooking.specialties.add"));
		await waitFor(() => expect(screen.getByText("app:cooking.specialties.added")).toBeTruthy());
		expect(jest.mocked(GameClient.request).mock.calls[0][0]).toBeInstanceOf(CookingSetSpecialtyReq);
		expect(jest.mocked(GameClient.request).mock.calls[0][0]).toMatchObject({
			slotIndex: 2, recipeId: "potion_health_1"
		});
	});
	it("does not offer to pin or re-add the recipe of the specialty station", async () => {
		await render(<HomeCooking />, { wrapper: provider(masterChefMenu()) });
		await fireEvent.press(screen.getAllByText("models:cooking.recipes.potion_time_2")[0]);
		expect(screen.getByText("app:cooking.craft")).toBeTruthy();
		expect(screen.queryByText("app:cooking.pin")).toBeNull();
		expect(screen.queryByText("app:cooking.specialties.add")).toBeNull();
	});
	it("says a full set of specialties before the press", async () => {
		const full = masterChefMenu();
		full.rules.specialtyLimit = 2;
		await render(<HomeCooking />, { wrapper: provider(full) });
		await fireEvent.press(screen.getByText("models:cooking.recipes.potion_health_1"));
		expect(screen.getByText("app:cooking.specialties.full")).toBeTruthy();
		await fireEvent.press(screen.getByText("app:cooking.specialties.add"));
		expect(GameClient.request).not.toHaveBeenCalled();
	});
	it("explains a specialty Core refused", async () => {
		jest.mocked(GameClient.request).mockResolvedValue(answer({
			kind: "specialtyChosen", menu: masterChefMenu(), error: CookingSpecialtyErrors.UNAVAILABLE
		}));
		await render(<HomeCooking />, { wrapper: provider(masterChefMenu()) });
		await fireEvent.press(screen.getByText("models:cooking.recipes.potion_health_1"));
		await fireEvent.press(screen.getByText("app:cooking.specialties.add"));
		await waitFor(() => expect(screen.getByText("app:cooking.errors.specialtyUnavailable")).toBeTruthy());
		expect(screen.queryByText("app:cooking.specialties.added")).toBeNull();
	});
	it("removes a specialty from its entry, from the view it was shown in", async () => {
		const cold = {
			...masterChefMenu(), isIgnited: false, currentSlots: []
		};
		jest.mocked(GameClient.request).mockResolvedValue(answer({
			kind: "specialtyRemoved", menu: cold
		}));
		await render(<HomeCooking />, { wrapper: provider(cold) });
		await fireEvent.press(screen.getByText("models:cooking.recipes.potion_attack_3"));
		await fireEvent.press(screen.getByText("app:cooking.specialties.remove"));
		await waitFor(() => expect(screen.getByText("app:cooking.specialties.removed")).toBeTruthy());
		expect(jest.mocked(GameClient.request).mock.calls[0][0]).toBeInstanceOf(CookingRemoveSpecialtyReq);
		expect(jest.mocked(GameClient.request).mock.calls[0][0]).toMatchObject({
			recipeId: "potion_attack_3", fromIgnitedView: false
		});
	});
	it("counts the time potions left only once few remain", async () => {
		const few = menu();
		few.currentSlots = [timePotionSlot(1, "potion_time_1", 4), timePotionSlot(3, "potion_time_3", 25)];
		await render(<HomeCooking />, { wrapper: provider(few) });
		expect(screen.getAllByText("app:cooking.timePotionsLeft")).toHaveLength(1);
	});
	it("names the exhausted week as the reason a time potion cannot be cooked, and offers no pin for it", async () => {
		const exhausted = menu();
		exhausted.currentSlots = [timePotionSlot(1, "potion_time_1", 0)];
		await render(<HomeCooking />, { wrapper: provider(exhausted) });
		expect(screen.getByText("app:cooking.locks.timePotionsExhausted")).toBeTruthy();
		await fireEvent.press(screen.getByText("models:cooking.recipes.potion_time_1"));
		expect(screen.queryByText("app:cooking.pin")).toBeNull();
	});
});
