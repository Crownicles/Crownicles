import { CrowniclesEmbed } from "./CrowniclesEmbed";
import { MessageActionRowComponentBuilder } from "@discordjs/builders";
import {
	ActionRowBuilder, Collector, Message
} from "discord.js";
import { CrowniclesInteraction } from "./CrowniclesInteraction";
import { disableRows } from "../utils/DiscordCollectorUtils";

// Needed because we need to accept any parameter
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CrowniclesNestedMenuCollector = Collector<any, any, any>;

export type CrowniclesNestedMenu = {
	embed: CrowniclesEmbed;
	components: ActionRowBuilder<MessageActionRowComponentBuilder>[];
	createCollector?: (nestedMenus: CrowniclesNestedMenus, message: Message) => CrowniclesNestedMenuCollector;
};

export class CrowniclesNestedMenus {
	private readonly _mainMenu: CrowniclesNestedMenu;

	private readonly _menus: Map<string, CrowniclesNestedMenu>;

	private _message: Message | undefined;

	private _currentCollector: CrowniclesNestedMenuCollector | undefined;

	private readonly _onChangeMenu: (() => void) | undefined;

	private _currentMenu: CrowniclesNestedMenu;

	constructor(mainMenu: CrowniclesNestedMenu, menus: Map<string, CrowniclesNestedMenu>, _onChangeMenu: (() => void) | undefined = undefined) {
		this._menus = menus;
		this._mainMenu = mainMenu;
		this._currentMenu = mainMenu;
		this._onChangeMenu = _onChangeMenu;
	}

	public async send(interaction: CrowniclesInteraction): Promise<Message> {
		const msg = await interaction.editReply({
			embeds: [this._mainMenu.embed],
			components: this._mainMenu.components
		});
		if (!msg) {
			throw new Error("Failed to send message");
		}
		this._message = msg;
		if (this._mainMenu.createCollector) {
			this._currentCollector = this._mainMenu.createCollector(this, msg);
		}
		return msg;
	}

	public async changeMenu(id: string): Promise<void> {
		if (!this._message) {
			throw new Error("Message not sent yet");
		}
		const menu = this._menus.get(id);
		if (!menu) {
			throw new Error(`Menu with id ${id} not found`);
		}
		await this.changeToMenu(menu);
	}

	public async changeToMainMenu(): Promise<void> {
		if (!this._message) {
			throw new Error("Message not sent yet");
		}
		await this.changeToMenu(this._mainMenu);
	}

	public async stopCurrentCollector(): Promise<void> {
		if (this._currentCollector) {
			this._currentCollector.stop();
			this._currentCollector = undefined;
		}
		if (this._message) {
			const components = this._currentMenu.components;
			disableRows(components);
			await this._message.edit({
				components
			});
		}
	}

	private async changeToMenu(menu: CrowniclesNestedMenu): Promise<void> {
		if (!this._message) {
			throw new Error("Message not sent yet");
		}
		await this._message.edit({
			embeds: [menu.embed],
			components: menu.components
		});
		this._currentMenu = menu;
		if (this._currentCollector) {
			this._currentCollector.stop();
			this._currentCollector = undefined;
		}
		if (menu.createCollector) {
			this._currentCollector = menu.createCollector(this, this._message);
		}
		if (this._onChangeMenu) {
			this._onChangeMenu();
		}
	}

	/**
	 * Update the current menu's embed and/or components without changing menus.
	 * Does NOT restart the collector - the current collector continues.
	 */
	public async updateCurrentMenu(updates: {
		description?: string;
		components?: ActionRowBuilder<MessageActionRowComponentBuilder>[];
	}): Promise<void> {
		if (!this._message) {
			throw new Error("Message not sent yet");
		}

		const newEmbed = this._currentMenu.embed;
		if (updates.description !== undefined) {
			newEmbed.setDescription(updates.description);
		}

		const components = updates.components ?? this._currentMenu.components;

		await this._message.edit({
			embeds: [newEmbed],
			components
		});

		// Update stored components if changed
		if (updates.components !== undefined) {
			this._currentMenu.components = updates.components;
		}
	}
}
