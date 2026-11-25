import {
	describe, expect, it, vi
} from "vitest";

vi.mock("../../src/bot/CrowniclesShard", () => ({
	crowniclesClient: {}
}));

import {
	ActionRowBuilder, APIButtonComponentWithCustomId, APIContainerComponent, APIMessageTopLevelComponent, ButtonBuilder, ButtonStyle,
	ComponentType, ContainerBuilder, Message
} from "discord.js";
import {
	CrowniclesNestedMenu, CrowniclesNestedMenus
} from "../../src/messages/CrowniclesNestedMenus";
import { CrowniclesEmbed } from "../../src/messages/CrowniclesEmbed";
import { CrowniclesInteraction } from "../../src/messages/CrowniclesInteraction";

type MessageEdit = {
	components: { toJSON: () => APIMessageTopLevelComponent }[];
	flags: string[];
};

function createButton(customId: string): ButtonBuilder {
	return new ButtonBuilder()
		.setCustomId(customId)
		.setLabel(customId)
		.setStyle(ButtonStyle.Primary);
}

/**
 * Send the main menu through a fake interaction, and return the fake message it was sent in
 */
async function sendMainMenu(mainMenu: CrowniclesNestedMenu, menus: Map<string, CrowniclesNestedMenu>): Promise<{
	nestedMenus: CrowniclesNestedMenus;
	edit: ReturnType<typeof vi.fn>;
}> {
	const edit = vi.fn().mockResolvedValue(undefined);
	const message = { edit } as unknown as Message;
	const interaction = {
		editReply: vi.fn().mockResolvedValue(message)
	} as unknown as CrowniclesInteraction;
	const nestedMenus = new CrowniclesNestedMenus(mainMenu, menus);
	await nestedMenus.send(interaction);
	return {
		nestedMenus, edit
	};
}

function getButtons(edit: ReturnType<typeof vi.fn>): APIButtonComponentWithCustomId[] {
	const { components } = edit.mock.calls.at(-1)![0] as MessageEdit;
	const container = components[0].toJSON() as APIContainerComponent;
	return container.components.flatMap(component => {
		if (component.type === ComponentType.ActionRow) {
			return component.components as APIButtonComponentWithCustomId[];
		}
		if (component.type === ComponentType.Section) {
			return [component.accessory as APIButtonComponentWithCustomId];
		}
		return [];
	});
}

describe("CrowniclesNestedMenus", () => {
	it("shows the buttons of an embed menu opened from a components v2 menu", async () => {
		const { nestedMenus, edit } = await sendMainMenu(
			{ containers: [new ContainerBuilder().addTextDisplayComponents(text => text.setContent("main"))] },
			new Map([
				[
					"detail", {
						embed: new CrowniclesEmbed().setDescription("detail"),
						components: [new ActionRowBuilder<ButtonBuilder>().addComponents(createButton("confirm"))]
					}
				]
			])
		);

		await nestedMenus.changeMenu("detail");

		expect((edit.mock.calls.at(-1)![0] as MessageEdit).flags).toEqual(["IsComponentsV2"]);
		expect(getButtons(edit).map(button => button.custom_id)).toEqual(["confirm"]);
	});

	it("disables the section buttons of a components v2 menu when its collector stops", async () => {
		const { nestedMenus, edit } = await sendMainMenu(
			{
				containers: [
					new ContainerBuilder()
						.addSectionComponents(section => section
							.addTextDisplayComponents(text => text.setContent("item"))
							.setButtonAccessory(createButton("select")))
						.addActionRowComponents(new ActionRowBuilder<ButtonBuilder>().addComponents(createButton("back")))
				]
			},
			new Map()
		);

		await nestedMenus.stopCurrentCollector();

		expect(getButtons(edit).map(button => [button.custom_id, button.disabled])).toEqual([["select", true], ["back", true]]);
	});
});
