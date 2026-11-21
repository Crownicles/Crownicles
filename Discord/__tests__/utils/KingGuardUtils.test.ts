import {
	describe, expect, it, vi
} from "vitest";

vi.mock("../../src/bot/CrowniclesShard", () => ({
	keycloakConfig: {},
	crowniclesClient: {}
}));

import { KingGuardUtils } from "../../src/utils/KingGuardUtils";
import { resolveKeycloakPlayerName } from "../../src/utils/KeycloakPlayerUtils";
import { KingGuardIdentity } from "../../../Lib/src/utils/KingGuardIdentity";
import { StringConstants } from "../../../Lib/src/constants/StringConstants";
import i18n from "../../src/translations/i18n";
import { LANGUAGE } from "../../../Lib/src/Language";

describe("King guard names", () => {
	const firstName = i18n.t("kingGuards:names.5", { lng: "fr" });

	it("names a guard of the library with its unique first name and its title", () => {
		expect(KingGuardUtils.getFirstName(5, "fr")).toMatch(/^\p{Lu}\p{L}+$/u);
		expect(KingGuardUtils.getDisplayName(5, "fr")).toBe(`Garde ${firstName}`);
	});

	it("names the guard behind the identifier sent in place of a keycloak id, without asking keycloak", async () => {
		await expect(resolveKeycloakPlayerName(KingGuardIdentity.toKeycloakId(5), "fr")).resolves.toBe(`Garde ${firstName}`);
	});

	it("agrees the recap of the fight with the sex of the guard", () => {
		const recap = (result: string, sex: string): string => i18n.t(`commands:fight.kingGuard.outcome.${result}`, {
			lng: "fr",
			player: "Joueur",
			guard: firstName,
			context: sex
		});

		expect(recap("win", StringConstants.SEX.FEMALE.long)).toContain(`${firstName}, garde du roi, et l'a vaincue.`);
		expect(recap("win", StringConstants.SEX.MALE.long)).toContain(`${firstName}, garde du roi, et l'a vaincu.`);
		expect(recap("draw", StringConstants.SEX.FEMALE.long)).toContain("la départager");
		expect(recap("draw", StringConstants.SEX.MALE.long)).toContain("le départager");
		expect(recap("loss", StringConstants.SEX.FEMALE.long)).toContain(`${firstName}, garde du roi, et a été vaincu.`);
	});

	it("names the guard in every language, the translations not synced yet falling back to French", () => {
		for (const lng of LANGUAGE.LANGUAGES) {
			const outcome = i18n.t("commands:fight.kingGuard.outcome.win", {
				lng,
				player: "Player",
				guard: KingGuardUtils.getFirstName(5, lng),
				context: StringConstants.SEX.FEMALE.long
			});

			expect(KingGuardUtils.getDisplayName(5, lng), lng).toContain(firstName);
			expect(outcome, lng).toContain(firstName);
		}
	});
});
