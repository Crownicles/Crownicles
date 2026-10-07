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
import {
	PetEntities, PetEntity
} from "../../core/database/game/models/PetEntity";
import {
	commandRequires, CommandUtils
} from "../../core/utils/CommandUtils";
import { PetExpeditions } from "../../core/database/game/models/PetExpedition";
import { PlayerTalismansManager } from "../../core/database/game/models/PlayerTalismans";
import { PetDataController } from "../../data/Pet";
import { expeditionStartBlocker } from "../../core/expeditions/ExpeditionValidation";
import {
	ExpeditionConstants, ExpeditionLocationType
} from "../../../../Lib/src/constants/ExpeditionConstants";

type OwnPetDetails = Pick<CommandPetPacketRes, "hasTalisman" | "feedAvailableAt" | "expeditionInProgress" | "expeditionBlocker">;

async function getExpeditionInProgress(player: Player): Promise<PetExpeditionInfo | undefined> {
	const currentExpedition = await PetExpeditions.getActiveExpeditionForPlayer(player.id);
	if (currentExpedition?.status !== ExpeditionConstants.STATUS.IN_PROGRESS) {
		return undefined;
	}
	return {
		endTime: currentExpedition.endDate.getTime(),
		startTime: currentExpedition.startDate.getTime(),
		riskRate: currentExpedition.riskRate,
		difficulty: currentExpedition.difficulty,
		locationType: currentExpedition.locationType as ExpeditionLocationType,
		mapLocationId: currentExpedition.mapLocationId,
		foodConsumed: currentExpedition.foodConsumed
	};
}

/**
 * What only the owner gets to see about their own pet: the expedition in progress, the talisman, the feeding cooldown
 * and what keeps the pet from leaving
 */
async function getOwnPetDetails(player: Player, pet: PetEntity): Promise<OwnPetDetails> {
	const expeditionInProgress = await getExpeditionInProgress(player);
	const petModel = PetDataController.instance.getById(pet.typeId)!;
	const feedCooldown = pet.getFeedCooldown(petModel);
	const hasTalisman = (await PlayerTalismansManager.getOfPlayer(player.id)).hasTalisman;
	const blocker = hasTalisman ? expeditionStartBlocker(player, pet, petModel) : ExpeditionConstants.ERROR_CODES.NO_TALISMAN;
	return {
		hasTalisman,
		...feedCooldown > 0 ? { feedAvailableAt: Date.now() + feedCooldown } : {},
		...expeditionInProgress ? { expeditionInProgress } : {},
		...blocker && !expeditionInProgress ? { expeditionBlocker: blocker } : {}
	};
}

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
		if (!toCheckPlayer) {
			response.push(makePacket(CommandPetPetNotFound, {}));
			return;
		}
		const pet = await PetEntities.getById(toCheckPlayer.petId);
		if (!pet) {
			response.push(makePacket(CommandPetPetNotFound, {}));
			return;
		}

		response.push(makePacket(CommandPetPacketRes, {
			askedKeycloakId: toCheckPlayer.keycloakId,
			pet: pet.asOwnedPet(),
			...toCheckPlayer.id === player.id ? await getOwnPetDetails(player, pet) : {}
		}));
	}
}
