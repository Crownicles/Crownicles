import { crowniclesMetricsRegistry } from "../../src/bot/CrowniclesDiscordMetrics";

/**
 * Read the size of a shard cache as exposed to Prometheus
 */
export async function getExposedCacheSize(cache: string): Promise<number | undefined> {
	const metric = await crowniclesMetricsRegistry.getSingleMetric("discord_cache_entries")!.get();
	return metric.values.find(value => value.labels.cache === cache)?.value;
}
