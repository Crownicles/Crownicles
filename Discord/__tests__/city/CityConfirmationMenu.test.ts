import {
	describe, expect, it, vi
} from "vitest";
import { Message, MessageComponentInteraction } from "discord.js";
import { LANGUAGE } from "../../../Lib/src/Language";
import { ReportCityMenuIds } from "../../src/commands/player/report/ReportCityMenuConstants";
import { registerCityConfirmationMenu } from "../../src/commands/player/report/confirmation/CityConfirmationMenu";
import { CrowniclesNestedMenu } from "../../src/messages/CrowniclesNestedMenus";

type MockCollectorHarness = {
	message: Message;
	collect: (interaction: MessageComponentInteraction) => Promise<void>;
};

type MockButton = {
	interaction: MessageComponentInteraction;
	deferUpdate: ReturnType<typeof vi.fn>;
};

function createMessageHarness(): MockCollectorHarness {
	let collectHandler: ((interaction: MessageComponentInteraction) => Promise<void>) | undefined;
	const collector = {
		on: vi.fn((event: string, handler: (interaction: MessageComponentInteraction) => Promise<void>) => {
			if (event === "collect") {
				collectHandler = handler;
			}
			return collector;
		})
	};
	const message = {
		createMessageComponentCollector: vi.fn(() => collector)
	} as unknown as Message;
	return {
		message,
		collect: async interaction => {
			if (!collectHandler) {
				throw new Error("Collector was not registered");
			}
			await collectHandler(interaction);
		}
	};
}

function createButton(customId: string): MockButton {
	const deferUpdate = vi.fn().mockResolvedValue(undefined);
	return {
		interaction: {
			customId,
			user: { id: "user-id" },
			deferUpdate
		} as unknown as MessageComponentInteraction,
		deferUpdate
	};
}

function registerMenu(onConfirm = vi.fn().mockResolvedValue(undefined)): {
	nestedMenus: {
		registerMenu: ReturnType<typeof vi.fn>;
		changeMenu: ReturnType<typeof vi.fn>;
	};
	menu: CrowniclesNestedMenu;
	onConfirm: ReturnType<typeof vi.fn>;
} {
	const nestedMenus = {
		registerMenu: vi.fn(),
		changeMenu: vi.fn().mockResolvedValue(undefined)
	};
	registerCityConfirmationMenu(nestedMenus as never, {
		interaction: {
			user: { id: "user-id" },
			userLanguage: LANGUAGE.FRENCH
		} as never,
		collectorTime: 1000,
		lng: LANGUAGE.FRENCH,
		pseudo: "Tester",
		description: "Résumé de l'action",
		confirmLabel: "Confirmer",
		backMenuId: "BACK_MENU",
		onConfirm
	});
	return {
		nestedMenus,
		menu: nestedMenus.registerMenu.mock.calls[0][1] as CrowniclesNestedMenu,
		onConfirm
	};
}

describe("registerCityConfirmationMenu", () => {
	it("returns to the configured menu on cancel without running the action", async () => {
		const {
			nestedMenus, menu, onConfirm
		} = registerMenu();
		const harness = createMessageHarness();
		menu.createCollector!(nestedMenus as never, harness.message);
		const cancelButton = createButton(ReportCityMenuIds.CITY_CONFIRMATION_CANCEL);

		await harness.collect(cancelButton.interaction);

		expect(cancelButton.deferUpdate).toHaveBeenCalledOnce();
		expect(nestedMenus.changeMenu).toHaveBeenCalledWith("BACK_MENU");
		expect(onConfirm).not.toHaveBeenCalled();
	});

	it("runs the pending action only when the confirm button is clicked", async () => {
		const {
			nestedMenus, menu, onConfirm
		} = registerMenu();
		const harness = createMessageHarness();
		menu.createCollector!(nestedMenus as never, harness.message);
		const confirmButton = createButton(ReportCityMenuIds.CITY_CONFIRMATION_CONFIRM);

		await harness.collect(confirmButton.interaction);

		expect(onConfirm).toHaveBeenCalledWith({
			buttonInteraction: confirmButton.interaction,
			nestedMenus
		});
		expect(nestedMenus.changeMenu).not.toHaveBeenCalled();
	});
});
