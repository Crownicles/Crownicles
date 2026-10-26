import { CrowniclesInteraction } from "../messages/CrowniclesInteraction";
import { Constants } from "../../../Lib/src/constants/Constants";
import {
	CrowniclesDiscordMetrics, DISCORD_MONITORED_CACHES
} from "./CrowniclesDiscordMetrics";
import {
	ButtonInteraction, StringSelectMenuInteraction
} from "discord.js";

type CachedInteraction<T> = {
	interaction: T;
	expiresAt: number;
};

type InteractionCache<T> = Map<string, CachedInteraction<T>>;

export class DiscordCache {
	private static readonly PURGE_INTERVAL_MS = 60000;

	private static initialized = false;

	private static interactionsCache: InteractionCache<CrowniclesInteraction> = new Map();

	private static buttonInteractionsCache: InteractionCache<ButtonInteraction> = new Map();

	private static stringSelectMenuInteractionsCache: InteractionCache<StringSelectMenuInteraction> = new Map();

	static {
		CrowniclesDiscordMetrics.registerCacheSize(DISCORD_MONITORED_CACHES.INTERACTIONS, () => DiscordCache.interactionsCache.size);
		CrowniclesDiscordMetrics.registerCacheSize(DISCORD_MONITORED_CACHES.BUTTON_INTERACTIONS, () => DiscordCache.buttonInteractionsCache.size);
		CrowniclesDiscordMetrics.registerCacheSize(DISCORD_MONITORED_CACHES.STRING_SELECT_MENU_INTERACTIONS, () => DiscordCache.stringSelectMenuInteractionsCache.size);
	}

	private static init(): void {
		if (!DiscordCache.initialized) {
			setInterval(() => DiscordCache.purge(), DiscordCache.PURGE_INTERVAL_MS).unref();
			DiscordCache.initialized = true;
		}
	}

	private static purgeExpired<T>(cache: InteractionCache<T>, now: number): void {
		for (const [id, entry] of cache) {
			if (entry.expiresAt < now) {
				cache.delete(id);
			}
		}
	}

	private static cache<T>(cache: InteractionCache<T>, id: string, interaction: T): void {
		DiscordCache.init();
		cache.set(id, {
			interaction,
			expiresAt: Date.now() + Constants.CACHE_TIME.INTERACTIONS
		});
	}

	/**
	 * Remove every expired interaction from all the interaction caches
	 * @param now - Reference time, defaults to the current time
	 */
	public static purge(now = Date.now()): void {
		DiscordCache.purgeExpired(DiscordCache.interactionsCache, now);
		DiscordCache.purgeExpired(DiscordCache.buttonInteractionsCache, now);
		DiscordCache.purgeExpired(DiscordCache.stringSelectMenuInteractionsCache, now);
	}

	public static cacheInteraction(interaction: CrowniclesInteraction): void {
		DiscordCache.cache(DiscordCache.interactionsCache, interaction.id, interaction);
	}

	public static cacheButtonInteraction(interaction: ButtonInteraction): void {
		DiscordCache.cache(DiscordCache.buttonInteractionsCache, interaction.id, interaction);
	}

	public static cacheStringSelectMenuInteraction(component: StringSelectMenuInteraction): void {
		DiscordCache.cache(DiscordCache.stringSelectMenuInteractionsCache, component.id, component);
	}

	public static getInteraction(id: string): CrowniclesInteraction | null {
		return DiscordCache.interactionsCache.get(id)?.interaction ?? null;
	}

	public static getButtonInteraction(id: string): ButtonInteraction | null {
		return DiscordCache.buttonInteractionsCache.get(id)?.interaction ?? null;
	}

	public static getStringSelectMenuInteraction(id: string): StringSelectMenuInteraction | null {
		return DiscordCache.stringSelectMenuInteractionsCache.get(id)?.interaction ?? null;
	}
}
