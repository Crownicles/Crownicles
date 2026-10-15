import {
	fireEvent, render, screen
} from "@testing-library/react-native";
import {
	CITY_REACTION_KINDS, CityMobileSnapshot, ReactionCollectorReaction
} from "ws-packets/src/fromServer/collectors";
import { ItemRecycleRes } from "ws-packets/src/fromServer/report/ItemRecycleRes";
import { submenuSections } from "@/src/collectors/CitySubmenuSections";
import {
	cityRecycleConfirm, cityRecycleDetails
} from "@/src/collectors/CityRecycleDetails";
import { cityRowSubtitle } from "@/src/collectors/CityRowSubtitle";
import { ItemRecycleOutcome } from "@/src/collectors/ItemRecycleOutcome";
import { EnchantedStory } from "@/src/collectors/CityItemStories";
import type { CityListItem } from "@/src/collectors/CityCollector";

const deps = {
	homeFeatureItems: (): [] => [], gardenPlotItems: (): [] => [], enchantmentCatalogItems: (): [] => []
};

const recycleReaction = {
	type: CITY_REACTION_KINDS.SCRAP_DEALER_RECYCLE,
	data: {
		slot: 1, itemCategory: 0, itemId: 1
	}
} as ReactionCollectorReaction;

const materials = [
	{
		materialId: 68, quantity: 2
	},
	{
		materialId: 34, quantity: 1
	}
];

function workshop(overrides: Partial<NonNullable<CityMobileSnapshot["scrapDealer"]>> = {}): CityMobileSnapshot {
	return { scrapDealer: {
		recyclableItems: [
			{
				slot: 1, itemId: 1, itemCategory: 0, itemLevel: 5, recoveredMaterials: materials, recoveredMoney: 1_019
			}
		],
		...overrides
	} };
}

function describeItem(item: CityListItem): string {
	return item.kind === "info" ? `${item.title} — ${item.lock?.reason ?? ""}` : item.kind;
}

describe("scrap dealer bench", () => {
	it("sums each item up by the materials it gives back", () => {
		expect(cityRowSubtitle(recycleReaction, workshop())).toBe("Niveau 5 · rend 3 matériaux");
	});

	it("names the enchanted reserve items it refuses, after what it can dismantle", () => {
		const sections = submenuSections("scrapDealer", [
			{
				reaction: recycleReaction, index: 3
			}
		], workshop({ enchantedItems: [
			{
				slot: 2, itemId: 10, itemCategory: 1, itemLevel: 3
			}
		] }), deps);

		expect(sections.map(section => section.title)).toEqual(["À démonter"]);
		expect(sections[0].items.map(describeItem)).toEqual(["reaction", expect.stringMatching(/Enchanté : à désenchanter chez un forgeron d'abord$/u)]);
	});

	it("says which items it takes when the bench stays empty", () => {
		const sections = submenuSections("scrapDealer", [], workshop({
			recyclableItems: [], enchantedItems: []
		}), deps);

		expect(sections[0].items.map(describeItem)).toEqual(["L'établi de Gorim reste vide — Seules les armes et armures de réserve non enchantées se démontent."]);
	});

	it("shows every material it gives back and warns that dismantling cannot be undone", async () => {
		await render(<>{cityRecycleDetails(recycleReaction, workshop())}</>);

		expect(screen.getAllByTestId("event-effect")).toHaveLength(3);
		expect(cityRecycleConfirm(recycleReaction, workshop())).toMatchObject({
			label: "Démonter l'équipement", hint: { reason: "Le démontage est définitif : l'équipement sera détruit." }
		});
	});

	it("explains that an enchanted item must be disenchanted first", async () => {
		await render(<EnchantedStory item={{
			slot: 2, itemId: 10, itemCategory: 1, itemLevel: 3
		}} />);

		expect(screen.getByText("Gorim refuse d'y toucher")).toBeTruthy();
	});
});

describe("item recycle celebration", () => {
	it("pops what the dismantled item gave back, then lets the player move on", async () => {
		const onContinue = jest.fn();
		await render(<ItemRecycleOutcome outcome={{
			itemId: 1, itemCategory: 0, itemLevel: 5, materials, moneyGained: 1_019
		} as ItemRecycleRes} onContinue={onContinue} />);

		expect(screen.getByText("Gorim a démonté votre équipement")).toBeTruthy();
		expect(screen.getByText("3 matériaux rejoignent votre réserve")).toBeTruthy();
		expect(screen.getAllByTestId("event-effect")).toHaveLength(3);
		fireEvent.press(screen.getByText("Continuer"));
		expect(onContinue).toHaveBeenCalled();
	});
});
