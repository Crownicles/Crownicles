import { CrowniclesEmbed } from "./CrowniclesEmbed";
import {
	ContainerBuilder, MessageActionRowComponentBuilder,
	SectionBuilder, TextDisplayBuilder
} from "@discordjs/builders";
import {
	ActionRowBuilder, ButtonBuilder, Collector, Message
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
} | {
	containers: ContainerBuilder[];
	createCollector?: (nestedMenus: CrowniclesNestedMenus, message: Message) => CrowniclesNestedMenuCollector;
};

function isV2Menu(menu: CrowniclesNestedMenu): menu is {
	containers: ContainerBuilder[];
	createCollector?: (nestedMenus: CrowniclesNestedMenus, message: Message) => CrowniclesNestedMenuCollector;
} {
	return "containers" in menu;
}

/**
 * Disable all interactive components in V2 containers (buttons in action rows and section accessories)
 */
function disableV2Containers(containers: ContainerBuilder[]): void {
	for (const container of containers) {
		for (const component of container.components) {
			if (component instanceof ActionRowBuilder) {
				for (const child of component.components) {
					if (child instanceof ButtonBuilder) {
						child.setDisabled(true);
					}
				}
			}
			else if (component instanceof SectionBuilder) {
				if (component.accessory instanceof ButtonBuilder) {
					component.accessory.setDisabled(true);
				}
			}
		}
	}
}

/**
 * Convert an embed-based menu to a V2 container.
 * Used as a fallback when a message is already in V2 mode and cannot switch back to embed.
 */
function embedMenuToV2Container(
	menu: {
		embed: CrowniclesEmbed;
		components: ActionRowBuilder<MessageActionRowComponentBuilder>[];
	}
): ContainerBuilder {
	const container = new ContainerBuilder();

	const author = menu.embed.data.author;
	if (author?.name) {
		container.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(`### ${author.name}`)
		);
	}

	if (menu.embed.data.description) {
		container.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(menu.embed.data.description)
		);
	}

	if (menu.embed.data.fields) {
		for (const field of menu.embed.data.fields) {
			container.addTextDisplayComponents(
				new TextDisplayBuilder().setContent(`**${field.name}**\n${field.value}`)
			);
		}
	}

	for (const row of menu.components) {
		container.addActionRowComponents(row);
	}

	return container;
}

export class CrowniclesNestedMenus {
	private readonly _mainMenu: CrowniclesNestedMenu;

	private readonly _menus: Map<string, CrowniclesNestedMenu>;

	private _message: Message | undefined;

	private _currentCollector: CrowniclesNestedMenuCollector | undefined;

	private readonly _onChangeMenu: (() => void) | undefined;

	private _currentMenu: CrowniclesNestedMenu;

	private _isV2 = false;

	constructor(mainMenu: CrowniclesNestedMenu, menus: Map<string, CrowniclesNestedMenu>, _onChangeMenu: (() => void) | undefined = undefined) {
		this._menus = menus;
		this._mainMenu = mainMenu;
		this._currentMenu = mainMenu;
		this._onChangeMenu = _onChangeMenu;
	}

	/**
	 * Register a new menu dynamically
	 */
	public registerMenu(id: string, menu: CrowniclesNestedMenu): void {
		this._menus.set(id, menu);
	}

	public get message(): Message | undefined {
		return this._message;
	}

	public async send(interaction: CrowniclesInteraction): Promise<Message> {
		const menu = this._mainMenu;
		if (isV2Menu(menu)) {
			this._isV2 = true;
		}
		const msg = isV2Menu(menu)
			? await interaction.editReply({
				embeds: [],
				components: menu.containers,
				flags: ["IsComponentsV2"]
			})
			: await interaction.editReply({
				embeds: [menu.embed],
				components: menu.components
			});
		if (!msg) {
			throw new Error("Failed to send message");
		}
		this._message = msg;
		if (menu.createCollector) {
			this._currentCollector = menu.createCollector(this, msg);
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
			const menu = this._currentMenu;
			if (isV2Menu(menu)) {
				disableV2Containers(menu.containers);
				await this._message.edit({
					components: menu.containers,
					flags: ["IsComponentsV2"]
				});
			}
			else if (this._isV2) {
				// Message is V2 but current menu is embed — auto-convert
				const container = embedMenuToV2Container(menu);
				disableV2Containers([container]);
				await this._message.edit({
					components: [container],
					flags: ["IsComponentsV2"]
				});
			}
			else {
				const components = menu.components;
				disableRows(components);
				await this._message.edit({
					components
				});
			}
		}
	}

	private async changeToMenu(menu: CrowniclesNestedMenu): Promise<void> {
		if (!this._message) {
			throw new Error("Message not sent yet");
		}
		if (isV2Menu(menu)) {
			this._isV2 = true;
			await this._message.edit({
				embeds: [],
				components: menu.containers,
				flags: ["IsComponentsV2"]
			});
		}
		else if (this._isV2) {
			// Message is already V2, can't switch back to embed — auto-convert
			const container = embedMenuToV2Container(menu);
			await this._message.edit({
				embeds: [],
				components: [container],
				flags: ["IsComponentsV2"]
			});
		}
		else {
			await this._message.edit({
				embeds: [menu.embed],
				components: menu.components,
				flags: [] as const
			});
		}
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
}
