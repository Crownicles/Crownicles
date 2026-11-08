import { changeLanguage } from "i18next";
import { ShopPetCheckupRes } from "ws-packets/src/fromServer/shop/ShopRes";
import { petCheckupReport } from "@/src/display/PetCheckup";
import { applyServerBundle } from "@/src/translations/i18nLoader";
import { fakeGameRules } from "@/src/testing/fakeGameRules";
import frenchCommands from "../../../Lang/fr/commands.json";
import frenchApp from "../../../Lang/fr/app.json";
import frenchModels from "../../../Lang/fr/models.json";

const VET = frenchCommands.shop.shopItems.lovePointsValue;
const PET_INFORMATION_ICONS = [
	"loveScore",
	"diet",
	"force",
	"speed",
	"feedDelay",
	"nextFeed",
	"age",
	"fightEffect"
];

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

function writesOneOf(report: string, comments: string[]): boolean {
	return comments.some(comment => report.includes(comment));
}

describe("vet checkup report", () => {
	beforeAll(async () => {
		await changeLanguage("fr");
		applyServerBundle({
			language: "fr",
			namespaces: {
				commands: frenchCommands, app: frenchApp, models: frenchModels
			},
			icons: {
				petInformation: Object.fromEntries(PET_INFORMATION_ICONS.map(icon => [icon, icon])),
				pets: { 42: { emoteFemale: "mammoth" } },
				diet: { herbivorous: "herbivorous" },
				effects: { starving: "starving" },
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
		const report = petCheckupReport(checkup({
			fightAssistId: "petCharge", secondFightAssistId: "unstoppable"
		}));
		expect(writesOneOf(report, VET.commentOnFightEffect.petCharge)).toBe(true);
		expect(report).toContain(SECOND_POWER_LABEL);
		expect(writesOneOf(report.slice(report.indexOf(SECOND_POWER_LABEL)), VET.commentOnFightEffect.unstoppable)).toBe(true);
	});

	it("counts the time between meals from the milliseconds Core sends", () => {
		expect(petCheckupReport(checkup({}))).toContain("3 h 30");
	});

	it("names the biomes the pet likes and dislikes", () => {
		const report = petCheckupReport(checkup({
			likedExpeditionTypes: ["coast"], dislikedExpeditionTypes: ["swamp"]
		}));
		expect(report).toContain(frenchModels.biomes.coast);
		expect(report).toContain(frenchModels.biomes.swamp);
		expect(report).not.toContain("models:");
	});

	it("tells no second power for a pet with a single one", () => {
		const report = petCheckupReport(checkup({ fightAssistId: "claws" }));
		expect(writesOneOf(report, VET.commentOnFightEffect.claws)).toBe(true);
		expect(report).not.toContain(SECOND_POWER_LABEL);
	});
});
