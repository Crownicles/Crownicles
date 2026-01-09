import {
	CrowniclesPacket, makePacket
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	Player, Players
} from "../../core/database/game/models/Player";
import {
	CommandPetPacketReq,
	CommandPetPacketRes,
	CommandPetPetNotFound,
	PetExpeditionInfo
} from "../../../../Lib/src/packets/commands/CommandPetPacket";
import { PetEntities } from "../../core/database/game/models/PetEntity";
import {
	commandRequires, CommandUtils
} from "../../core/utils/CommandUtils";
import { PetExpeditions } from "../../core/database/game/models/PetExpedition";
import { PlayerTalismansManager } from "../../core/database/game/models/PlayerTalismans";
import {
	ExpeditionConstants, ExpeditionLocationType
} from "../../../../Lib/src/constants/ExpeditionConstants";

export default class PetCommand {
	@commandRequires(CommandPetPacketReq, {
		notBlocked: false,
		disallowedEffects: CommandUtils.DISALLOWED_EFFECTS.NOT_STARTED_OR_DEAD,
		whereAllowed: CommandUtils.WHERE.EVERYWHERE
	})
	/**
	 * Displays information about a player's pet
	 * @param response - Array to collect response packets
	 * @param player - The player executing the command
	 * @param packet - The request packet with optional target player
	 */
	async execute(response: CrowniclesPacket[], player: Player, packet: CommandPetPacketReq): Promise<void> {
		const toCheckPlayer = await Players.getAskedPlayer(packet.askedPlayer, player);
		const pet = await PetEntities.getById(toCheckPlayer.petId);
		if (!pet) {
			response.push(makePacket(CommandPetPetNotFound, {}));
			return;
		}

		// Check if the player being viewed has an expedition in progress
		const isOwnerViewingOwnPet = toCheckPlayer.id === player.id;
		let expeditionInfo: PetExpeditionInfo | undefined;

		if (isOwnerViewingOwnPet) {
			const currentExpedition = await PetExpeditions.getActiveExpeditionForPlayer(player.id);
			if (currentExpedition && currentExpedition.status === ExpeditionConstants.STATUS.IN_PROGRESS) {
				expeditionInfo = {
					endTime: currentExpedition.endDate.getTime(),
					startTime: currentExpedition.startDate.getTime(),
					riskRate: currentExpedition.riskRate,
					difficulty: currentExpedition.difficulty,
					locationType: currentExpedition.locationType as ExpeditionLocationType,
					mapLocationId: currentExpedition.mapLocationId,
					foodConsumed: currentExpedition.foodConsumed
				};
			}
		}

		// Get talisman status if viewing own pet
		const hasTalisman = isOwnerViewingOwnPet
			? (await PlayerTalismansManager.getOfPlayer(player.id)).hasTalisman
			: undefined;

		response.push(makePacket(CommandPetPacketRes, {
			askedKeycloakId: toCheckPlayer?.keycloakId,
			pet: pet.asOwnedPet(),
			hasTalisman,
			expeditionInProgress: expeditionInfo
		}));
	}
}
