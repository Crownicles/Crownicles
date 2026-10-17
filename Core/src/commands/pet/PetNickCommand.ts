import {
	CrowniclesPacket, makePacket
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { PetEntity } from "../../core/database/game/models/PetEntity";
import {
	CommandPetNickPacketReq,
	CommandPetNickPacketRes
} from "../../../../Lib/src/packets/commands/CommandPetNickPacket";
import { checkNameString } from "../../../../Lib/src/utils/StringUtils";
import { PetConstants } from "../../../../Lib/src/constants/PetConstants";
import {
	commandRequires, CommandUtils
} from "../../core/utils/CommandUtils";
import Player from "../../core/database/game/models/Player";
import { crowniclesInstance } from "../../app";
import {
	Locked, LockedRowNotFoundError, withLockedEntities
} from "../../../../Lib/src/locks/withLockedEntities";

/**
 * In-lock body: the pet may have been transferred, sold or freed between the
 * command being accepted and the write, so the ownership is re-checked here.
 */
async function applyLockedRename(
	locked: {
		player: Locked<Player>; pet: Locked<PetEntity>;
	},
	expectedPetId: number,
	nickname: string
): Promise<PetEntity | null> {
	const {
		player, pet
	} = locked;

	if (player.petId !== expectedPetId) {
		return null;
	}

	pet.nickname = nickname;
	await pet.save();
	return pet;
}

/**
 * Persist the new nickname under a player + pet lock. Returns null when the player
 * no longer owns that pet, or when the pet row vanished concurrently.
 */
export async function renameOwnPet(player: Player, expectedPetId: number, nickname: string): Promise<PetEntity | null> {
	try {
		return await withLockedEntities(
			[
				Player.lockKey(player.id),
				PetEntity.lockKey(expectedPetId)
			] as const,
			async ([lockedPlayer, lockedPet]) => await applyLockedRename(
				{
					player: lockedPlayer, pet: lockedPet
				},
				expectedPetId,
				nickname
			)
		);
	}
	catch (error) {
		if (!(error instanceof LockedRowNotFoundError)) {
			throw error;
		}
		return null;
	}
}

export default class PetNickCommand {
	@commandRequires(CommandPetNickPacketReq, {
		notBlocked: true,
		disallowedEffects: CommandUtils.DISALLOWED_EFFECTS.NOT_STARTED_OR_DEAD,
		whereAllowed: CommandUtils.WHERE.EVERYWHERE
	})
	async execute(response: CrowniclesPacket[], player: Player, packet: CommandPetNickPacketReq): Promise<void> {
		const expectedPetId = player.petId;
		if (expectedPetId === null) {
			response.push(makePacket(CommandPetNickPacketRes, {
				foundPet: false
			}));
			return;
		}

		const newPetNickName = packet.newNickname;
		if (newPetNickName && !checkNameString(newPetNickName, PetConstants.NICKNAME_LENGTH_RANGE)) {
			response.push(makePacket(CommandPetNickPacketRes, {
				foundPet: true,
				newNickname: newPetNickName,
				nickNameIsAcceptable: false
			}));
			return;
		}

		// An empty nickname resets it to None
		const renamedPet = await renameOwnPet(player, expectedPetId, newPetNickName ?? "");
		if (!renamedPet) {
			response.push(makePacket(CommandPetNickPacketRes, {
				foundPet: false
			}));
			return;
		}

		response.push(makePacket(CommandPetNickPacketRes, {
			foundPet: true,
			newNickname: newPetNickName,
			nickNameIsAcceptable: true
		}));

		crowniclesInstance?.logsDatabase.logPetNickname(renamedPet, player.keycloakId).then();
	}
}
