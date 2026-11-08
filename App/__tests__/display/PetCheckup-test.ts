import { petCheckupSummary } from "@/src/display/PetCheckup";
import { ShopPetCheckupRes } from "ws-packets/src/fromServer/shop/ShopRes";

jest.mock("@/src/translations/i18n", () => ({ i18n: { t: (key: string, options?: object): string => `${key}${options ? ` ${JSON.stringify(options)}` : ""}` } }));
jest.mock("@/src/translations/RandomTranslation", () => ({ randomTranslation: (key: string, options?: object): string => `${key}${options ? ` ${JSON.stringify(options)}` : ""}` }));
jest.mock("@/src/AppIcons", () => ({ AppIcons: {
	getIcon: (path: string): string => `icon:${path}`, getIconOrNull: (path: string): string => `icon:${path}`
} }));
jest.mock("@/src/display/PetDisplay", () => ({
	petIcon: (): string => "petIcon",
	petTypeName: (): string => "petName"
}));
jest.mock("@/src/display/ItemEffects", () => ({ formatDurationMinutes: (minutes: number): string => `duration:${minutes}` }));

const KEY = "commands:shop.shopItems.lovePointsValue";

function buildPet(overrides: Partial<ShopPetCheckupRes> = {}): ShopPetCheckupRes {
	const base: ShopPetCheckupRes = {
		typeId: 7,
		sex: "f",
		petId: 3,
		loveLevel: 2,
		ageCategory: "adult",
		lovePoints: 40,
		maxLovePoints: 100,
		lovePointsGained: 5,
		force: 12,
		speed: 9,
		diet: "carnivorous",
		feedDelay: 3_600_000,
		nextFeed: 1_800_000,
		fightAssistId: "1",
		secondFightAssistId: undefined,
		likedExpeditionTypes: [],
		dislikedExpeditionTypes: [],
		randomPetDwarf: undefined
	};
	return Object.assign(base, overrides);
}

describe("petCheckupSummary", () => {
	it("converts the feeding delays from milliseconds to minutes", () => {
		const summary = petCheckupSummary(buildPet({
			feedDelay: 3_600_000,
			nextFeed: 1_800_000
		}));
		expect(summary.feedInterval).toBe("duration:60");
		expect(summary.nextFeed).toBe("duration:30");
	});

	it("reports the hungry text when the next feed is already due", () => {
		const summary = petCheckupSummary(buildPet({ nextFeed: 0 }));
		expect(summary.nextFeed).toBe(`${KEY}.petIsHungry`);
	});

	it("counts no affection gained when the vet gave none", () => {
		expect(petCheckupSummary(buildPet({ lovePointsGained: undefined })).lovePointsGained).toBe(0);
	});

	it("omits the second fight effect when there is none", () => {
		const summary = petCheckupSummary(buildPet({ secondFightAssistId: undefined }));
		expect(summary.fightEffects).toHaveLength(1);
	});

	it("adds a second fight effect when present", () => {
		const summary = petCheckupSummary(buildPet({ secondFightAssistId: "4" }));
		expect(summary.fightEffects).toHaveLength(2);
		expect(summary.fightEffects[1]).toContain(`${KEY}.secondFightEffect`);
	});

	it("uses the no-preferences text when the pet has no expedition likes", () => {
		const summary = petCheckupSummary(buildPet());
		expect(summary.expeditions).toBe(`${KEY}.noPreferences`);
	});

	it("names liked and disliked expedition biomes with their icons", () => {
		const summary = petCheckupSummary(buildPet({
			likedExpeditionTypes: ["forest"],
			dislikedExpeditionTypes: ["desert"]
		}));
		expect(summary.expeditions).toContain("icon:expedition.locations.forest");
		expect(summary.expeditions).toContain("icon:expedition.locations.desert");
		expect(summary.expeditions).toContain(`${KEY}.expeditionPreferences`);
	});

	it("leaves the dwarf aside empty when no dwarf is around", () => {
		expect(petCheckupSummary(buildPet()).dwarfAside).toBe("");
	});
});
