import { ReactionCollectorDataKind } from "../ReactionCollectorProtocol";

declare module "../ReactionCollectorProtocol" {
	interface ReactionCollectorDataPayloads {
		guildDescription: { description: string };
		guildLeave: {
			guildName: string; isGuildDestroyed: boolean;
		};
		guildCreate: {
			guildName: string; price: number;
		};
	}
}
export const GUILD_DATA_KINDS = {
	CREATE: "guildCreate", DESCRIPTION: "guildDescription", LEAVE: "guildLeave"
} as const satisfies Record<string, ReactionCollectorDataKind>;
