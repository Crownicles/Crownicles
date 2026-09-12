import { ReactionCollectorDataKind } from "../ReactionCollectorProtocol";

declare module "../ReactionCollectorProtocol" {
	interface ReactionCollectorDataPayloads {
		guildReimburse: { amount: number };
		guildInvite: { guildName: string };
		guildMemberAction: {
			action: "kick" | "promote" | "demote"; guildName: string; memberName?: string;
		};
		guildDescription: { description: string };
		guildLeave: {
			guildName: string; isGuildDestroyed: boolean; memberName?: string;
		};
		guildCreate: {
			guildName: string; price: number;
		};
	}
}
export const GUILD_DATA_KINDS = {
	CREATE: "guildCreate", DESCRIPTION: "guildDescription", LEAVE: "guildLeave", INVITE: "guildInvite", MEMBER: "guildMemberAction", REIMBURSE: "guildReimburse"
} as const satisfies Record<string, ReactionCollectorDataKind>;
