import i18next from "i18next";
import {i18n} from "@/src/translations/i18n";
import {reloadI18n} from "@/src/translations/i18nLoader";

describe("i18n loader", () => {
	it("loads downloaded namespaces before exposing translations", async () => {
		await reloadI18n(new Map([
			["Lang/fr/app.json", JSON.stringify({common: {loading: "Chargement"}})],
			["Lang/fr/commands.json", JSON.stringify({report: {title: "Rapport"}})],
			["Lang/fr/smallEvents.json", JSON.stringify({story: ["Premier récit", "Second récit"]})]
		]));

		expect(i18next.t("app:common.loading")).toBe("Chargement");
		expect(i18next.t("commands:report.title")).toBe("Rapport");
		expect(i18n.tArray("smallEvents:story")).toEqual(["Premier récit", "Second récit"]);
	});

	it("serializes concurrent reloads without losing the latest resources", async () => {
		await Promise.all([
			reloadI18n(new Map([["Lang/fr/app.json", JSON.stringify({common: {loading: "Premier"}})]])),
			reloadI18n(new Map([["Lang/fr/app.json", JSON.stringify({common: {loading: "Dernier"}})]]))
		]);

		expect(i18next.t("app:common.loading")).toBe("Dernier");
	});

	it("falls back to the available French app namespace", async () => {
		await reloadI18n(new Map([["Lang/fr/app.json", JSON.stringify({common: {loading: "Chargement"}})]]));
		await i18next.changeLanguage("en");

		expect(i18next.t("app:common.loading")).toBe("Chargement");
	});
});
