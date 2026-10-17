import {
	APIEmbed, BaseGuildTextChannel, TextChannel
} from "discord.js";
import { crowniclesClient } from "../bot/CrowniclesShard";

export type ShardChannelMessage = {
	content?: string;
	embeds: APIEmbed[];
};

/**
 * Post in a guild channel from any shard: only the shard owning the guild is able to send it
 * @param channelId
 * @param message
 * @returns Whether a shard posted the message
 */
export async function sendInGuildChannelFromAnyShard(channelId: string, message: ShardChannelMessage): Promise<boolean> {
	const results = await crowniclesClient.shard!.broadcastEval((client, context) =>
		client.channels.fetch(context.channelId)
			.then(channel => {
				if ((<BaseGuildTextChannel>channel).guild.shardId === client.shard!.ids[0]) {
					return (<TextChannel>channel).send(context.message).then(() => true);
				}
				return false;
			})
			.catch(() => false), {
		context: {
			channelId,
			message
		}
	});
	return results.includes(true);
}
