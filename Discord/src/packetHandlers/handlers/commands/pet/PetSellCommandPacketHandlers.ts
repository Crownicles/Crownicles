import { packetHandler } from "../../../PacketHandler";
import {
	CommandPetSellNoPetErrorPacket,
	CommandPetSellNotInGuildErrorPacket,
	CommandPetSellFeistyErrorPacket,
	CommandPetSellBadPriceErrorPacket,
	CommandPetSellOnlyOwnerCanCancelErrorPacket,
	CommandPetSellCancelPacket,
	CommandPetSellCantSellToYourselfErrorPacket,
	CommandPetSellSameGuildError,
	CommandPetSellAlreadyHavePetError,
	CommandPetSellNotEnoughMoneyError,
	CommandPetSellInitiatorSituationChangedErrorPacket,
	CommandPetSellPetOnExpeditionErrorPacket,
	CommandPetSellSuccessPacket, CommandPetSellNoOneAvailableErrorPacket
} from "../../../../../../Lib/src/packets/commands/CommandPetSellPacket";
import { PacketContext } from "../../../../../../Lib/src/packets/CrowniclesPacket";
import { handleClassicError } from "../../../../utils/ErrorUtils";
import { handlePetSellSuccess } from "../../../../commands/pet/PetSellCommand";

export default class PetSellCommandPacketHandlers {
	@packetHandler(CommandPetSellNoPetErrorPacket)
	async handleNoPetError(context: PacketContext, _packet: CommandPetSellNoPetErrorPacket): Promise<void> {
		await handleClassicError(context, "commands:petSell.noPet");
	}

	@packetHandler(CommandPetSellPetOnExpeditionErrorPacket)
	async handlePetOnExpeditionError(context: PacketContext, _packet: CommandPetSellPetOnExpeditionErrorPacket): Promise<void> {
		await handleClassicError(context, "commands:petSell.petOnExpedition");
	}

	@packetHandler(CommandPetSellNotInGuildErrorPacket)
	async handleNotInGuildError(context: PacketContext, _packet: CommandPetSellNotInGuildErrorPacket): Promise<void> {
		await handleClassicError(context, "commands:petSell.noGuild");
	}

	@packetHandler(CommandPetSellFeistyErrorPacket)
	async handleFeistyError(context: PacketContext, _packet: CommandPetSellFeistyErrorPacket): Promise<void> {
		await handleClassicError(context, "commands:petSell.isFeisty");
	}

	@packetHandler(CommandPetSellBadPriceErrorPacket)
	async handleBadPrice(context: PacketContext, packet: CommandPetSellBadPriceErrorPacket): Promise<void> {
		await handleClassicError(context, "commands:petSell.badPrice", {
			minPrice: packet.minPrice,
			maxPrice: packet.maxPrice
		});
	}

	@packetHandler(CommandPetSellOnlyOwnerCanCancelErrorPacket)
	async handleOnlyOwnerCanCancelError(context: PacketContext, _packet: CommandPetSellOnlyOwnerCanCancelErrorPacket): Promise<void> {
		await handleClassicError(context, "commands:petSell.onlyInitiatorCanCancel");
	}

	@packetHandler(CommandPetSellCancelPacket)
	async handleCancel(context: PacketContext, _packet: CommandPetSellCancelPacket): Promise<void> {
		await handleClassicError(context, "commands:petSell.canceled");
	}

	@packetHandler(CommandPetSellCantSellToYourselfErrorPacket)
	async handleCantBuyOwnPetError(context: PacketContext, _packet: CommandPetSellCantSellToYourselfErrorPacket): Promise<void> {
		await handleClassicError(context, "commands:petSell.cantSellToYourself");
	}

	@packetHandler(CommandPetSellSameGuildError)
	async handleSameGuildError(context: PacketContext, _packet: CommandPetSellSameGuildError): Promise<void> {
		await handleClassicError(context, "commands:petSell.sameGuild");
	}

	@packetHandler(CommandPetSellAlreadyHavePetError)
	async handleAlreadyHavePetError(context: PacketContext, _packet: CommandPetSellAlreadyHavePetError): Promise<void> {
		await handleClassicError(context, "commands:petSell.alreadyHavePet");
	}

	@packetHandler(CommandPetSellNotEnoughMoneyError)
	async handleNotEnoughMoneyError(context: PacketContext, packet: CommandPetSellNotEnoughMoneyError): Promise<void> {
		await handleClassicError(context, "commands:petSell.notEnoughMoney", {
			missingMoney: packet.missingMoney
		});
	}

	@packetHandler(CommandPetSellInitiatorSituationChangedErrorPacket)
	async handleInitiatorSituationChangedError(context: PacketContext, _packet: CommandPetSellInitiatorSituationChangedErrorPacket): Promise<void> {
		await handleClassicError(context, "commands:petSell.initiatorSituationChanged");
	}

	@packetHandler(CommandPetSellSuccessPacket)
	async handleSuccess(context: PacketContext, packet: CommandPetSellSuccessPacket): Promise<void> {
		await handlePetSellSuccess(context, packet);
	}

	@packetHandler(CommandPetSellNoOneAvailableErrorPacket)
	async handleNoOneAvailableError(context: PacketContext, _packet: CommandPetSellNoOneAvailableErrorPacket): Promise<void> {
		await handleClassicError(context, "commands:petSell.noOneAvailable");
	}
}
