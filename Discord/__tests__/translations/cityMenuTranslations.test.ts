import fs from "node:fs";
import path from "node:path";
import i18next, { TFunction } from "i18next";
import { describe, expect, it } from "vitest";

const DISCORD_BUTTON_LABEL_MAX_LENGTH = 80;

describe("City menu translation lengths", () => {
	const langDir = path.resolve(__dirname, "../../../Lang");
	const locales = getLocales(langDir);

	for (const locale of locales) {
		it(`keeps V2 button labels within Discord limits for ${locale}`, async () => {
			const commands = loadCommandsJson(langDir, locale);
			if (!commands?.report?.city) {
				return;
			}
			const models = loadModelsJson(langDir, locale);
			const t = await buildTranslator(locale, commands, models);

			// City menus are rendered with V2 components (TextDisplay + Buttons)
			// Only check button labels which have Discord limits
			checkInnMenu(commands.report.city, locale, t);
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

function checkInnMenu(_city: CityTranslations, locale: Locale, t: TFunction): void {
	// Inn menus use V2 SectionBuilder: meal/room names and descriptions are in TextDisplay (no limit)
	// Only button labels have a Discord limit
	const buttonLabels = [
		"commands:report.city.buttons.order",
		"commands:report.city.buttons.rent",
		"commands:report.city.exitInn",
		"commands:report.city.reactions.stay.label"
	];

	for (const key of buttonLabels) {
		validateLength(t(key), locale, key);
	}
}

function validateLength(value: unknown, locale: Locale, key: string): void {
	if (typeof value !== "string") {
		return;
	}
	const trimmedValue = value.trim();
	expect(
		trimmedValue.length,
		`${locale}:${key} ("${trimmedValue}") exceeds Discord's ${DISCORD_BUTTON_LABEL_MAX_LENGTH} character button label limit.`
	).toBeLessThanOrEqual(DISCORD_BUTTON_LABEL_MAX_LENGTH);
}
