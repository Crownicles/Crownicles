import {
	describe, expect, it, vi
} from "vitest";

const editReply = vi.fn();

vi.mock("../../src/utils/MessagesUtils", () => ({
	MessagesUtils: {
		getCurrentInteraction: (): unknown => ({
			user: {
				id: "discord-user-id",
				displayAvatarURL: (): string => "https://avatar"
			},
			editReply
		})
	}
}));

vi.mock("../../src/utils/DisplayUtils", () => ({
	DisplayUtils: {
		getEscapedUsername: (): Promise<string> => Promise.resolve("Player")
	}
}));

import { LANGUAGE } from "../../../Lib/src/Language";
import { ItemEnchantment } from "../../../Lib/src/types/ItemEnchantment";
import { sendEnchantmentReply } from "../../src/commands/player/report/blacksmith/BlacksmithHandlers";

describe("enchantment replies", () => {
	it("renders the transferred enchantment and the price paid", async () => {
		await sendEnchantmentReply({
			keycloakId: "keycloak-id",
			discord: { language: LANGUAGE.FRENCH }
		} as never, {
			titleKey: "commands:report.city.blacksmith.enchantmentTransferTitle",
			descriptionKey: "commands:report.city.blacksmith.enchantmentTransferSuccess"
		}, {
			enchantmentId: ItemEnchantment.PVE_ATTACK_1.id,
			enchantmentType: ItemEnchantment.PVE_ATTACK_1.kind.type.id,
			cost: 400
		} as never);

		const description = editReply.mock.calls[0][0].embeds[0].data.description as string;
		expect(description).toContain("Attaque PvE I");
		expect(description).toContain("400");
		expect(description).not.toContain("{{");
	});
});
