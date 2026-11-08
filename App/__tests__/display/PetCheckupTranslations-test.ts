import { changeLanguage } from "i18next";
import { ShopPetCheckupRes } from "ws-packets/src/fromServer/shop/ShopRes";
import { petCheckupSummary } from "@/src/display/PetCheckup";
import { applyServerBundle } from "@/src/translations/i18nLoader";
import { fakeGameRules } from "@/src/testing/fakeGameRules";
import frenchCommands from "../../../Lang/fr/commands.json";
import frenchApp from "../../../Lang/fr/app.json";
import frenchModels from "../../../Lang/fr/models.json";

const VET = frenchCommands.shop.shopItems.lovePointsValue;

/** Core sends the time between meals in milliseconds: three hours and a half here. */
const FEED_DELAY_MS = 12_600_000;
const SECOND_POWER_LABEL = VET.secondFightEffect.slice(VET.secondFightEffect.indexOf("**"), VET.secondFightEffect.indexOf("{{comment}}"));

function checkup(overrides: Partial<ShopPetCheckupRes>): ShopPetCheckupRes {
	return Object.assign(new ShopPetCheckupRes(), {
		typeId: 42,
		petId: 3,
		sex: "f",
		nickname: "Moka",
		loveLevel: 2,
		lovePoints: 30,
		maxLovePoints: 100,
		diet: "herbivorous",
		ageCategory: "adult",
		nextFeed: 0,
		feedDelay: FEED_DELAY_MS,
		force: 12,
		speed: 9,
		fightAssistId: "claws",
		...overrides
	});
}

function oneOf(text: string, comments: string[]): boolean {
	return comments.some(comment => text.includes(comment));
}

describe("vet checkup in French", () => {
	beforeAll(async () => {
		await changeLanguage("fr");
		applyServerBundle({
			language: "fr",
			namespaces: {
				commands: frenchCommands, app: frenchApp, models: frenchModels
			},
			icons: {
				pets: { 42: { emoteFemale: "mammoth" } },
				expedition: {
					map: "map",
					liked: "liked",
					disliked: "disliked",
					locations: {
						coast: "coast", swamp: "swamp"
					}
				}
			},
			rules: fakeGameRules
		});
	});

	it("describes the second fight power of a pet that has one, after the first", () => {
		const { fightEffects } = petCheckupSummary(checkup({
			fightAssistId: "petCharge", secondFightAssistId: "unstoppable"
		}));
		expect(oneOf(fightEffects[0], VET.commentOnFightEffect.petCharge)).toBe(true);
		expect(fightEffects[1]).toContain(SECOND_POWER_LABEL);
		expect(oneOf(fightEffects[1], VET.commentOnFightEffect.unstoppable)).toBe(true);
	});

	it("tells no second power for a pet with a single one", () => {
		const { fightEffects } = petCheckupSummary(checkup({}));
		expect(fightEffects).toHaveLength(1);
		expect(oneOf(fightEffects[0], VET.commentOnFightEffect.claws)).toBe(true);
	});

	it("counts the time between meals from the milliseconds Core sends", () => {
		expect(petCheckupSummary(checkup({})).feedInterval).toBe("3 h 30");
	});

	it("names the biomes the pet likes and dislikes", () => {
		const { expeditions } = petCheckupSummary(checkup({
			likedExpeditionTypes: ["coast"], dislikedExpeditionTypes: ["swamp"]
		}));
		expect(expeditions).toContain(frenchModels.biomes.coast);
		expect(expeditions).toContain(frenchModels.biomes.swamp);
		expect(expeditions).not.toContain("models:");
	});
});
