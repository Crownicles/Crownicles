import {changeLanguage} from "i18next";
import {AppIcons} from "@/src/AppIcons";
import {i18n} from "@/src/translations/i18n";
import {applyServerBundle} from "@/src/translations/i18nLoader";
import {fakeGameRules} from "@/src/testing/fakeGameRules";
import {gameRules} from "@/src/rules/GameRules";
import frenchApp from "../../../Lang/fr/app.json";

const rules = fakeGameRules;

describe("i18n loader", () => {
	beforeEach(async () => {
		await changeLanguage("fr");
	});

	it("lets server translations override the embedded French resources", () => {
		applyServerBundle({
			language: "fr",
			namespaces: {app: {auth: {title: "Titre corrigé côté serveur"}}},
			icons: {},
			rules
		});

		expect(i18n.t("app:auth.title")).toBe("Titre corrigé côté serveur");
		expect(i18n.t("app:auth.caption")).toBe(frenchApp.auth.caption);
	});

	it("falls back to the embedded French resource for a non-French bundle", async () => {
		applyServerBundle({language: "en", namespaces: {app: {auth: {title: "The kingdom awaits"}}}, icons: {}, rules});
		await changeLanguage("en");

		expect(i18n.t("app:auth.title")).toBe("The kingdom awaits");
		expect(i18n.t("app:auth.caption")).toBe(frenchApp.auth.caption);
	});

	it("merges repeated server bundles without discarding earlier keys", () => {
		applyServerBundle({language: "fr", namespaces: {app: {boot: {updating: "Chargement personnalisé"}}}, icons: {}, rules});
		applyServerBundle({language: "fr", namespaces: {app: {boot: {error: "Erreur personnalisée"}}}, icons: {}, rules});

		expect(i18n.t("app:boot.updating")).toBe("Chargement personnalisé");
		expect(i18n.t("app:boot.error")).toBe("Erreur personnalisée");
	});

	it("replaces the current icon table directly", () => {
		const iconSpy = jest.spyOn(AppIcons, "reloadAppIcons");
		const icons = {clocks: ["CLOCK"]};
		applyServerBundle({language: "fr", namespaces: {}, icons, rules});
		expect(iconSpy).toHaveBeenCalledWith(icons);
	});

	it("reads the game values the server sends instead of keeping its own", () => {
		applyServerBundle({language: "fr", namespaces: {}, icons: {}, rules: {...rules, guild: {...rules.guild, creationPrice: 7_500}}});
		expect(gameRules().guild.creationPrice).toBe(7_500);
		applyServerBundle({language: "fr", namespaces: {}, icons: {}, rules});
	});
});
