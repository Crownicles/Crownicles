import {
	CrowniclesPacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandGuildInviteAcceptPacketRes, CommandGuildInviteErrorPacket, CommandGuildInviteRefusePacketRes
} from "../../../../Lib/src/packets/commands/CommandGuildInvitePacket";
import { ReactionCollectorGuildInvite } from "../../../../Lib/src/packets/interaction/ReactionCollectorGuildInvite";
import {
	EndCallback, ReactionCollectorInstance
} from "./ReactionsCollector";
import { PacketUtils } from "./PacketUtils";

const INVITATION_RESULTS = [
	CommandGuildInviteErrorPacket,
	CommandGuildInviteAcceptPacketRes,
	CommandGuildInviteRefusePacketRes
];

export function notifyInvitationAuthor(context: PacketContext, response: CrowniclesPacket[]): void {
	if (!context.webSocket) {
		return;
	}
	PacketUtils.sendPackets(context, response.filter(packet => INVITATION_RESULTS.some(Packet => packet instanceof Packet)));
}

export function createGuildInvitationCollector(model: ReactionCollectorGuildInvite, context: PacketContext, invitedKeycloakId: string, endCallback: EndCallback): ReactionCollectorInstance {
	return new ReactionCollectorInstance(model, context.webSocket ? PacketUtils.webSocketContextForPlayer(context, invitedKeycloakId) : context, {
		allowedPlayerKeycloakIds: [invitedKeycloakId], reactionLimit: 1
	}, endCallback);
}
