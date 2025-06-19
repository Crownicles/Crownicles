import { CrowniclesInteraction } from "../messages/CrowniclesInteraction";
import { Constants } from "../../../Lib/src/constants/Constants";
import {
	ButtonInteraction, StringSelectMenuInteraction
} from "discord.js";

export class DiscordCache {
	private static initialized = false;

	private static interactionsCache: Map<string, {
		interaction: CrowniclesInteraction; time: number;
	}> = new Map();

	private static buttonInteractionsCache: Map<string, {
		interaction: ButtonInteraction; time: number;
	}> = new Map();

	private static stringSelectMenuInteractionsCache: Map<string, {
		interaction: StringSelectMenuInteraction; time: number;
	}> = new Map();

	private static init(): void {
		if (!DiscordCache.initialized) {
			setInterval(DiscordCache.purge, 60000);
			DiscordCache.initialized = true;
		}
	}

	private static purge(): void {
		const now = Date.now();
		DiscordCache.interactionsCache.forEach(interactionEntry => {
			if (interactionEntry.time < now) {
				DiscordCache.interactionsCache.delete(interactionEntry.interaction.id);
			}
		});
	}

	public static cacheInteraction(interaction: CrowniclesInteraction): void {
		DiscordCache.init();
		DiscordCache.interactionsCache.set(interaction.id, {
			interaction, time: Date.now() + Constants.CACHE_TIME.INTERACTIONS
		});
	}

	public static cacheButtonInteraction(interaction: ButtonInteraction): void {
		DiscordCache.init();
		DiscordCache.buttonInteractionsCache.set(interaction.id, {
			interaction, time: Date.now() + Constants.CACHE_TIME.INTERACTIONS
		});
	}

	public static cacheStringSelectMenuInteraction(component: StringSelectMenuInteraction): void {
		DiscordCache.init();
		DiscordCache.stringSelectMenuInteractionsCache.set(component.id, {
			interaction: component, time: Date.now() + Constants.CACHE_TIME.INTERACTIONS
		});
	}

	public static getInteraction(id: string): CrowniclesInteraction | null {
		const entry = DiscordCache.interactionsCache.get(id);
		return entry?.interaction ?? null;
	}

	public static getButtonInteraction(id: string): ButtonInteraction | null {
		const entry = DiscordCache.buttonInteractionsCache.get(id);
		return entry?.interaction ?? null;
	}

	public static getStringSelectMenuInteraction(id: string): StringSelectMenuInteraction | null {
		const entry = DiscordCache.stringSelectMenuInteractionsCache.get(id);
		return entry?.interaction ?? null;
	}
}
