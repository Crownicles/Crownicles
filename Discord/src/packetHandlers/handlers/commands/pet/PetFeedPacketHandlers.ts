import { packetHandler } from "../../../PacketHandler";
import { PacketContext } from "../../../../../../Lib/src/packets/CrowniclesPacket";
import { handleClassicError } from "../../../../utils/ErrorUtils";
import {
	CommandPetFeedCancelErrorPacket,
	CommandPetFeedGuildStorageEmptyErrorPacket,
	CommandPetFeedNoMoneyFeedErrorPacket,
	CommandPetFeedNoPetErrorPacket,
	CommandPetFeedNotHungryErrorPacket,
	CommandPetFeedPetOnExpeditionErrorPacket,
	CommandPetFeedSuccessPacket
} from "../../../../../../Lib/src/packets/commands/CommandPetFeedPacket";
import { DisplayUtils } from "../../../../utils/DisplayUtils";
import { handleCommandPetFeedSuccessPacket } from "../../../../commands/pet/PetFeedCommand";

export default class PetFeedCommandPacketHandlers {
	@packetHandler(CommandPetFeedNoPetErrorPacket)
	async noPet(context: PacketContext, _packet: CommandPetFeedNoPetErrorPacket): Promise<void> {
		await handleClassicError(context, "commands:petFeed.noPet");
	}

	@packetHandler(CommandPetFeedPetOnExpeditionErrorPacket)
	async petOnExpedition(context: PacketContext, _packet: CommandPetFeedPetOnExpeditionErrorPacket): Promise<void> {
		await handleClassicError(context, "commands:petFeed.petOnExpedition");
	}

	@packetHandler(CommandPetFeedNoMoneyFeedErrorPacket)
	async noMoney(context: PacketContext, _packet: CommandPetFeedNoMoneyFeedErrorPacket): Promise<void> {
		await handleClassicError(context, "commands:petFeed.noMoney");
	}

	@packetHandler(CommandPetFeedNotHungryErrorPacket)
	async notHungry(context: PacketContext, packet: CommandPetFeedNotHungryErrorPacket): Promise<void> {
		await handleClassicError(context, "commands:petFeed.notHungry", {
			pet: DisplayUtils.getOwnedPetInlineDisplay(packet.pet, context.discord!.language)
		});
	}

	@packetHandler(CommandPetFeedGuildStorageEmptyErrorPacket)
	async guildStorageEmpty(context: PacketContext, _packet: CommandPetFeedGuildStorageEmptyErrorPacket): Promise<void> {
		await handleClassicError(context, "commands:petFeed.guildStorageEmpty");
	}

	@packetHandler(CommandPetFeedCancelErrorPacket)
	async cancel(context: PacketContext, _packet: CommandPetFeedCancelErrorPacket): Promise<void> {
		await handleClassicError(context, "commands:petFeed.cancelled");
	}

	@packetHandler(CommandPetFeedSuccessPacket)
	async success(context: PacketContext, packet: CommandPetFeedSuccessPacket): Promise<void> {
		await handleCommandPetFeedSuccessPacket(packet, context);
	}
}
