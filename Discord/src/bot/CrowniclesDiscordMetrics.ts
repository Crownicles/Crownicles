// skipcq: JS-C1003 - prom-client does not expose itself as an ES Module.
import * as client from "prom-client";

export const crowniclesMetricsRegistry = new client.Registry();

/*
 * The time buckets for the histogram are defined here
 * [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 6, 7, 8, 9, 10]
 */
const packetsTimeBuckets: number[] = [];
for (let i = 0.1; i < 1; i += 0.1) {
	packetsTimeBuckets.push(i);
}
for (let i = 1; i < 5; i += 0.5) {
	packetsTimeBuckets.push(i);
}
for (let i = 5; i <= 10; i += 1) {
	packetsTimeBuckets.push(i);
}

export abstract class CrowniclesDiscordMetrics {
	private static packetsTimeHistogram = new client.Histogram({
		name: "discord_packets_time",
		help: "Histogram of packets times",
		labelNames: ["packet"],
		registers: [crowniclesMetricsRegistry],
		buckets: packetsTimeBuckets
	});

	private static packetsCount = new client.Counter({
		name: "discord_packets_count",
		help: "Count of packets",
		labelNames: ["packet"],
		registers: [crowniclesMetricsRegistry]
	});

	private static packetsErrorCount = new client.Counter({
		name: "discord_packets_error_count",
		help: "Count of packets errors",
		labelNames: ["packet"],
		registers: [crowniclesMetricsRegistry]
	});

	static observePacketTime(packetName: string, time: number): void {
		this.packetsTimeHistogram.labels(packetName)
			.observe(time);
	}

	static incrementPacketCount(packetName: string): void {
		this.packetsCount.labels(packetName)
			.inc();
	}

	static incrementPacketErrorCount(packetName: string): void {
		this.packetsErrorCount.labels(packetName)
			.inc();
	}
}

client.collectDefaultMetrics({
	register: crowniclesMetricsRegistry
});
