import { packetHandler } from "../../PacketHandler";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import {
	SmallEventAltarContributedPacket,
	SmallEventAltarFirstEncounterPacket,
	SmallEventAltarNoContributionPacket
} from "../../../../../Lib/src/packets/smallEvents/SmallEventAltarPacket";
import {
	altarContributed, altarFirstEncounter, altarNoContribution
} from "../../../smallEvents/altar";

export default class AltarSmallEventHandler {
	@packetHandler(SmallEventAltarFirstEncounterPacket)
	async smallEventAltarFirstEncounter(context: PacketContext, packet: SmallEventAltarFirstEncounterPacket): Promise<void> {
		await altarFirstEncounter(packet, context);
	}


	@packetHandler(SmallEventAltarNoContributionPacket)
	async smallEventAltarNoContribution(context: PacketContext, packet: SmallEventAltarNoContributionPacket): Promise<void> {
		await altarNoContribution(packet, context);
	}


	@packetHandler(SmallEventAltarContributedPacket)
	async smallEventAltarContributed(context: PacketContext, packet: SmallEventAltarContributedPacket): Promise<void> {
		await altarContributed(packet, context);
	}
}
