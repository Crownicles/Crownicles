import { ReactionCollectorDataKind } from "../ReactionCollectorProtocol";

declare module "../ReactionCollectorProtocol" {
	interface ReactionCollectorDataPayloads {
		guildCreate: {
			guildName: string; price: number;
		};
	}
}
export const GUILD_DATA_KINDS = { CREATE: "guildCreate" } as const satisfies Record<string, ReactionCollectorDataKind>;
