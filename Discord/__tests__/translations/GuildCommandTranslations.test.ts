import fs from "node:fs";
import path from "node:path";
import i18next, { FormatFunction } from "i18next";
import {
	describe, expect, it
} from "vitest";

type CommandsTranslations = {
	guild: {
		info: string;
	};
};

const LANG_DIR = path.resolve(__dirname, "../../../Lang");

function loadCommandsTranslations(locale: string): CommandsTranslations {
	const filePath = path.join(LANG_DIR, locale, "commands.json");
	return JSON.parse(fs.readFileSync(filePath, "utf8")) as CommandsTranslations;
}

async function translateGuildInfo(locale: string): Promise<string> {
	const format: FormatFunction = (value, formatName, lng): string => formatName === "number"
		? new Intl.NumberFormat(lng).format(Number(value))
		: String(value);
	const instance = i18next.createInstance();
	await instance.init({
		lng: locale,
		fallbackLng: false,
		ns: ["commands"],
		defaultNS: "commands",
		interpolation: {
			escapeValue: false,
			format
		},
		resources: {
			[locale]: {
				commands: loadCommandsTranslations(locale)
			}
		}
	});

	return instance.t("guild.info", {
		experience: "115 455 / 230 000",
		guildPoints: 115455,
		ranking: "24 / 316"
	});
}

describe("guild command translations", () => {
	it("keeps the already formatted French experience value as text", async () => {
		const result = await translateGuildInfo("fr");

		expect(result).toContain("115 455 / 230 000");
		expect(result).not.toContain("NaN");
	});
});
