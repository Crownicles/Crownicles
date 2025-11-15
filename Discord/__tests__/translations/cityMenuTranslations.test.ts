import fs from "node:fs";
import path from "node:path";
import i18next, { TFunction } from "i18next";
import { describe, expect, it } from "vitest";

const DISCORD_SELECT_OPTION_MAX_LENGTH = 100;
const SAMPLE_PRICE = 999999;
const SAMPLE_ENERGY = 9999;
const SAMPLE_HEALTH = 9999;

describe("City menu translation lengths", () => {
	const langDir = path.resolve(__dirname, "../../../Lang");
	const locales = getLocales(langDir);

	for (const locale of locales) {
		it(`keeps select options within Discord limits for ${locale}`, async () => {
			const commands = loadCommandsJson(langDir, locale);
			if (!commands?.report?.city) {
				return;
			}
			const models = loadModelsJson(langDir, locale);
			const t = await buildTranslator(locale, commands, models);
			const { city } = commands.report;

			checkMainMenuReactions(city, locale, t);
			checkInnMenu(city, locale, t);
			checkShopEntries(city, locale, t);
		});
	}
});

type CommandsJson = {
	report?: {
		city?: {
			placeholder?: string;
			reactions?: Record<string, { label?: string; description?: string }>;
			shops?: Record<string, { label?: string; description?: string }>;
			inns?: {
				names?: Record<string, string>;
				meals?: Record<string, string>;
				rooms?: Record<string, string>;
			};
		};
	};
};

type ModelsJson = Record<string, unknown>;

type CityTranslations = NonNullable<NonNullable<CommandsJson["report"]>["city"]>;

type Locale = string;

function getLocales(langDir: string): Locale[] {
	return fs.readdirSync(langDir, { withFileTypes: true })
		.filter(entry => entry.isDirectory())
		.map(entry => entry.name);
}

function loadCommandsJson(langDir: string, locale: Locale): CommandsJson {
	const filePath = path.join(langDir, locale, "commands.json");
	if (!fs.existsSync(filePath)) {
		return {};
	}
	return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function loadModelsJson(langDir: string, locale: Locale): ModelsJson {
	const filePath = path.join(langDir, locale, "models.json");
	if (!fs.existsSync(filePath)) {
		return {};
	}
	return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

async function buildTranslator(locale: Locale, commands: CommandsJson, models: ModelsJson): Promise<TFunction> {
	const instance = i18next.createInstance();
	await instance.init({
		lng: locale,
		fallbackLng: false,
		interpolation: { escapeValue: false },
		ns: ["commands", "models"],
		defaultNS: "commands",
		resources: {
			[locale]: {
				commands,
				models
			}
		}
	});
	return instance.getFixedT(locale);
}

function checkMainMenuReactions(city: CityTranslations, locale: Locale, t: TFunction): void {
	const reactionKeys = Object.keys(city.reactions ?? {});
	for (const reactionKey of reactionKeys) {
		if (reactionKey === "inn") {
			const innIds = Object.keys(city.inns?.names ?? {});
			for (const innId of innIds) {
				const label = t("commands:report.city.reactions.inn.label", { innId });
				validateLength(label, locale, `commands.report.city.reactions.inn.label(${innId})`);
			}
			const description = t("commands:report.city.reactions.inn.description");
			validateLength(description, locale, "commands.report.city.reactions.inn.description");
			continue;
		}

		const label = t(`commands:report.city.reactions.${reactionKey}.label`);
		const description = t(`commands:report.city.reactions.${reactionKey}.description`);
		validateLength(label, locale, `commands.report.city.reactions.${reactionKey}.label`);
		validateLength(description, locale, `commands.report.city.reactions.${reactionKey}.description`);
	}

	validateLength(t("commands:report.city.placeholder"), locale, "commands.report.city.placeholder");
}

function checkInnMenu(city: CityTranslations, locale: Locale, t: TFunction): void {
	if (city.inns?.meals) {
		for (const [mealId, _mealName] of Object.entries(city.inns.meals)) {
			const mealLabel = t(`commands:report.city.inns.meals.${mealId}`);
			validateLength(mealLabel, locale, `commands.report.city.inns.meals.${mealId}`);
			const mealDescription = t("commands:report.city.inns.mealDescription", {
				price: SAMPLE_PRICE,
				energy: SAMPLE_ENERGY
			});
			validateLength(mealDescription, locale, "commands.report.city.inns.mealDescription");
		}
	}

	if (city.inns?.rooms) {
		for (const [roomId, _roomName] of Object.entries(city.inns.rooms)) {
			const roomLabel = t(`commands:report.city.inns.rooms.${roomId}`);
			validateLength(roomLabel, locale, `commands.report.city.inns.rooms.${roomId}`);
			const roomDescription = t("commands:report.city.inns.roomDescription", {
				price: SAMPLE_PRICE,
				health: SAMPLE_HEALTH
			});
			validateLength(roomDescription, locale, "commands.report.city.inns.roomDescription");
		}
	}

	validateLength(t("commands:report.city.exitInn"), locale, "commands.report.city.exitInn");
}

function checkShopEntries(city: CityTranslations, locale: Locale, t: TFunction): void {
	if (!city.shops) {
		return;
	}
	for (const shopId of Object.keys(city.shops)) {
		const label = t(`commands:report.city.shops.${shopId}.label`);
		const description = t(`commands:report.city.shops.${shopId}.description`);
		validateLength(label, locale, `commands.report.city.shops.${shopId}.label`);
		validateLength(description, locale, `commands.report.city.shops.${shopId}.description`);
	}
}

function validateLength(value: unknown, locale: Locale, key: string): void {
	if (typeof value !== "string") {
		return;
	}
	const trimmedValue = value.trim();
	expect(
		trimmedValue.length,
		`${locale}:${key} (“${trimmedValue}”) exceeds Discord's ${DISCORD_SELECT_OPTION_MAX_LENGTH} character select-option limit.`
	).toBeLessThanOrEqual(DISCORD_SELECT_OPTION_MAX_LENGTH);
}
