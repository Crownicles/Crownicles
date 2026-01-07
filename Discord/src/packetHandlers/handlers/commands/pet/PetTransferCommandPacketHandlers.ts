import { packetHandler } from "../../../PacketHandler";
import { PacketContext } from "../../../../../../Lib/src/packets/CrowniclesPacket";
import { handleClassicError } from "../../../../utils/ErrorUtils";
import {
	CommandPetTransferAnotherMemberTransferringErrorPacket,
	CommandPetTransferCancelErrorPacket,
	CommandPetTransferFeistyErrorPacket,
	CommandPetTransferFreeCooldownErrorPacket,
	CommandPetTransferFreeMissingMoneyErrorPacket,
	CommandPetTransferFreeSuccessPacket,
	CommandPetTransferNoPetErrorPacket,
	CommandPetTransferPetOnExpeditionErrorPacket,
	CommandPetTransferSituationChangedErrorPacket,
	CommandPetTransferSuccessPacket
} from "../../../../../../Lib/src/packets/commands/CommandPetTransferPacket";
import { KeycloakUtils } from "../../../../../../Lib/src/keycloak/KeycloakUtils";
import { keycloakConfig } from "../../../../bot/CrowniclesShard";
import {
	handlePetTransferFreeSuccess,
	handlePetTransferSuccess
} from "../../../../commands/pet/PetTransferCommand";
import { escapeUsername } from "../../../../utils/StringUtils";
import { printTimeBeforeDate } from "../../../../../../Lib/src/utils/TimeUtils";

export default class PetTransferCommandPacketHandlers {
	@packetHandler(CommandPetTransferAnotherMemberTransferringErrorPacket)
	async anotherPlayerTransferring(context: PacketContext, packet: CommandPetTransferAnotherMemberTransferringErrorPacket): Promise<void> {
		const getUser = await KeycloakUtils.getUserByKeycloakId(keycloakConfig, packet.keycloakId);
		if (getUser.isError) {
			return;
		}
		await handleClassicError(context, "commands:petTransfer.anotherPlayerTransferring", {
			playerName: escapeUsername(getUser.payload.user.attributes.gameUsername[0]),
			lng: context.discord!.language
		});
	}

	@packetHandler(CommandPetTransferCancelErrorPacket)
	async cancelError(context: PacketContext, _packet: CommandPetTransferCancelErrorPacket): Promise<void> {
		await handleClassicError(context, "commands:petTransfer.transferCancelled");
	}

	@packetHandler(CommandPetTransferSituationChangedErrorPacket)
	async situationChanged(context: PacketContext, _packet: CommandPetTransferSituationChangedErrorPacket): Promise<void> {
		await handleClassicError(context, "commands:petTransfer.situationChanged");
	}

	@packetHandler(CommandPetTransferNoPetErrorPacket)
	async noPetError(context: PacketContext, _packet: CommandPetTransferNoPetErrorPacket): Promise<void> {
		await handleClassicError(context, "commands:petTransfer.noPet");
	}

	@packetHandler(CommandPetTransferSuccessPacket)
	async transferSuccess(context: PacketContext, packet: CommandPetTransferSuccessPacket): Promise<void> {
		await handlePetTransferSuccess(context, packet);
	}

	@packetHandler(CommandPetTransferFeistyErrorPacket)
	async feistyError(context: PacketContext, _packet: CommandPetTransferFeistyErrorPacket): Promise<void> {
		await handleClassicError(context, "commands:petTransfer.feistyError");
	}

	@packetHandler(CommandPetTransferPetOnExpeditionErrorPacket)
	async petOnExpeditionError(context: PacketContext, _packet: CommandPetTransferPetOnExpeditionErrorPacket): Promise<void> {
		await handleClassicError(context, "commands:petTransfer.petOnExpedition");
	}

	@packetHandler(CommandPetTransferFreeCooldownErrorPacket)
	async freeCooldownError(context: PacketContext, packet: CommandPetTransferFreeCooldownErrorPacket): Promise<void> {
		await handleClassicError(context, "commands:petTransfer.freeCooldown", {
			time: printTimeBeforeDate(packet.cooldownRemainingTimeMs + new Date().valueOf())
		});
	}

	@packetHandler(CommandPetTransferFreeMissingMoneyErrorPacket)
	async freeMissingMoneyError(context: PacketContext, packet: CommandPetTransferFreeMissingMoneyErrorPacket): Promise<void> {
		await handleClassicError(context, "commands:petTransfer.freeMissingMoney", {
			missingMoney: packet.missingMoney
		});
	}

	@packetHandler(CommandPetTransferFreeSuccessPacket)
	async freeSuccess(context: PacketContext, packet: CommandPetTransferFreeSuccessPacket): Promise<void> {
		await handlePetTransferFreeSuccess(context, packet);
	}
}
