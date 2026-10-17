import { CrowniclesPacket } from "../../../../Lib/src/packets/CrowniclesPacket";
import { ReactionCollectorStopPacket } from "../../../../Lib/src/packets/interaction/ReactionCollectorStopPacket";

export async function runWithDeferredCollectorStop(
	response: CrowniclesPacket[],
	collectorId: string,
	openShop: () => Promise<void>
): Promise<void> {
	const stopPacketIndex = response.findIndex(packet => packet instanceof ReactionCollectorStopPacket && packet.id === collectorId);
	const [stopPacket] = stopPacketIndex === -1 ? [] : response.splice(stopPacketIndex, 1);
	try {
		await openShop();
	}
	finally {
		if (stopPacket) {
			response.push(stopPacket);
		}
	}
}
