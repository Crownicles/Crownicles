import {changeLanguage} from "i18next";
import {AppIcons} from "@/src/AppIcons";
import {i18n} from "@/src/translations/i18n";
import {applyServerBundle} from "@/src/translations/i18nLoader";

describe("i18n loader", () => {
	beforeEach(async () => {
		await changeLanguage("fr");
	});

	it("lets server translations override the embedded French resources", () => {
		applyServerBundle({
			language: "fr",
			namespaces: {app: {auth: {title: "Titre corrigé côté serveur"}}},
			icons: {}
		});

		expect(i18n.t("app:auth.title")).toBe("Titre corrigé côté serveur");
		expect(i18n.t("app:auth.caption")).toBe("Crownicles");
	});

	it("falls back to the embedded French resource for a non-French bundle", async () => {
		applyServerBundle({language: "en", namespaces: {app: {auth: {title: "The kingdom awaits"}}}, icons: {}});
		await changeLanguage("en");

		expect(i18n.t("app:auth.title")).toBe("The kingdom awaits");
		expect(i18n.t("app:auth.caption")).toBe("Crownicles");
	});

	it("merges repeated server bundles without discarding earlier keys", () => {
		applyServerBundle({language: "fr", namespaces: {app: {boot: {updating: "Chargement personnalisé"}}}, icons: {}});
		applyServerBundle({language: "fr", namespaces: {app: {boot: {error: "Erreur personnalisée"}}}, icons: {}});

		expect(i18n.t("app:boot.updating")).toBe("Chargement personnalisé");
		expect(i18n.t("app:boot.error")).toBe("Erreur personnalisée");
	});

	it("replaces the current icon table directly", () => {
		const iconSpy = jest.spyOn(AppIcons, "reloadAppIcons");
		const icons = {clocks: ["CLOCK"]};
		applyServerBundle({language: "fr", namespaces: {}, icons});
		expect(iconSpy).toHaveBeenCalledWith(icons);
	});
});
