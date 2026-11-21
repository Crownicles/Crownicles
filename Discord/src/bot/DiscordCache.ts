import { CrowniclesInteraction } from "../messages/CrowniclesInteraction";
import { Constants } from "../../../Lib/src/constants/Constants";
import { DiscordConstants } from "../DiscordConstants";
import {
	CrowniclesDiscordMetrics, DISCORD_MONITORED_CACHES
} from "./CrowniclesDiscordMetrics";
import { User } from "discord.js";

/**
 * Value kept until its interaction expires: an interaction, or what is still usable of an interaction that can no longer be answered
 */
type CachedEntry<T> = {
	value: T;
	expiresAt: number;
};

type InteractionCache<T> = Map<string, CachedEntry<T>>;

export class DiscordCache {
	private static initialized = false;

	private static interactionsCache: InteractionCache<CrowniclesInteraction> = new Map();

	/**
	 * Clicks on a button, cast to CrowniclesInteraction so that their answers get the error handling of the bot (#2754)
	 */
	private static buttonInteractionsCache: InteractionCache<CrowniclesInteraction> = new Map();

	/**
	 * Selections in a menu, cast to CrowniclesInteraction like the button clicks
	 */
	private static stringSelectMenuInteractionsCache: InteractionCache<CrowniclesInteraction> = new Map();

	/**
	 * Authors of the clicks whose acknowledgement failed: the click itself is not cached since Discord accepts no answer to it
	 */
	private static unanswerableClickUsersCache: InteractionCache<User> = new Map();

	static {
		CrowniclesDiscordMetrics.registerCacheSize(DISCORD_MONITORED_CACHES.INTERACTIONS, () => DiscordCache.interactionsCache.size);
		CrowniclesDiscordMetrics.registerCacheSize(DISCORD_MONITORED_CACHES.BUTTON_INTERACTIONS, () => DiscordCache.buttonInteractionsCache.size);
		CrowniclesDiscordMetrics.registerCacheSize(DISCORD_MONITORED_CACHES.STRING_SELECT_MENU_INTERACTIONS, () => DiscordCache.stringSelectMenuInteractionsCache.size);
		CrowniclesDiscordMetrics.registerCacheSize(DISCORD_MONITORED_CACHES.UNANSWERABLE_CLICK_USERS, () => DiscordCache.unanswerableClickUsersCache.size);
	}

	private static init(): void {
		if (!DiscordCache.initialized) {
			setInterval(() => DiscordCache.purge(), DiscordConstants.CACHE.INTERACTIONS_PURGE_INTERVAL).unref();
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

	private static cache<T>(cache: InteractionCache<T>, id: string, value: T): void {
		DiscordCache.init();
		cache.set(id, {
			value,
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
		DiscordCache.purgeExpired(DiscordCache.unanswerableClickUsersCache, now);
	}

	public static cacheInteraction(interaction: CrowniclesInteraction): void {
		DiscordCache.cache(DiscordCache.interactionsCache, interaction.id, interaction);
	}

	public static cacheButtonInteraction(interaction: CrowniclesInteraction): void {
		DiscordCache.cache(DiscordCache.buttonInteractionsCache, interaction.id, interaction);
	}

	public static cacheStringSelectMenuInteraction(interaction: CrowniclesInteraction): void {
		DiscordCache.cache(DiscordCache.stringSelectMenuInteractionsCache, interaction.id, interaction);
	}

	public static cacheUnanswerableClickUser(clickId: string, user: User): void {
		DiscordCache.cache(DiscordCache.unanswerableClickUsersCache, clickId, user);
	}

	public static getInteraction(id: string): CrowniclesInteraction | null {
		return DiscordCache.interactionsCache.get(id)?.value ?? null;
	}

	public static getButtonInteraction(id: string): CrowniclesInteraction | null {
		return DiscordCache.buttonInteractionsCache.get(id)?.value ?? null;
	}

	public static getStringSelectMenuInteraction(id: string): CrowniclesInteraction | null {
		return DiscordCache.stringSelectMenuInteractionsCache.get(id)?.value ?? null;
	}

	public static getUnanswerableClickUser(clickId: string): User | null {
		return DiscordCache.unanswerableClickUsersCache.get(clickId)?.value ?? null;
	}
}
