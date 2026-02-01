import {
	commandRequires, CommandUtils
} from "../../core/utils/CommandUtils";
import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import Player from "../../core/database/game/models/Player";
import {
	CommandClassesCancelErrorPacket,
	CommandClassesChangeSuccessPacket,
	CommandClassesCooldownErrorPacket,
	CommandClassesPacketReq
} from "../../../../Lib/src/packets/commands/CommandClassesPacket";
import { ClassDataController } from "../../data/Class";
import { LogsReadRequests } from "../../core/database/logs/LogsReadRequests";
import { InventorySlots } from "../../core/database/game/models/InventorySlot";
import { ReactionCollectorInstance } from "../../core/utils/ReactionsCollector";
import { BlockingConstants } from "../../../../Lib/src/constants/BlockingConstants";
import {
	ReactionCollectorChangeClass,
	ReactionCollectorChangeClassDetails,
	ReactionCollectorChangeClassReaction
} from "../../../../Lib/src/packets/interaction/ReactionCollectorChangeClass";
import { BlockingUtils } from "../../core/utils/BlockingUtils";
import { ReactionCollectorRefuseReaction } from "../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import { MissionsController } from "../../core/missions/MissionsController";
import { crowniclesInstance } from "../../index";
import { WhereAllowed } from "../../../../Lib/src/types/WhereAllowed";
import { ClassConstants } from "../../../../Lib/src/constants/ClassConstants";
import { secondsToMilliseconds } from "../../../../Lib/src/utils/TimeUtils";

function getEndCallback(player: Player) {
	return async (collector: ReactionCollectorInstance, response: CrowniclesPacket[]): Promise<void> => {
		BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.CLASS);

		const firstReaction = collector.getFirstReaction();
		if (!firstReaction || firstReaction.reaction.type === ReactionCollectorRefuseReaction.name) {
			response.push(makePacket(CommandClassesCancelErrorPacket, {}));
			return;
		}

		await player.reload();
		const selectedClass = (firstReaction.reaction.data as ReactionCollectorChangeClassReaction).classId;
		const oldClass = ClassDataController.instance.getById(player.class);
		const newClass = ClassDataController.instance.getById(selectedClass);
		const level = player.level;

		if (!oldClass || !newClass) {
			response.push(makePacket(CommandClassesCancelErrorPacket, {}));
			return;
		}

		player.class = selectedClass;
		const playerActiveObjects = await InventorySlots.getPlayerActiveObjects(player.id);
		await player.addHealthSimple({
			amount: Math.ceil(
				player.getHealthValue() / oldClass.getMaxHealthValue(level) * newClass.getMaxHealthValue(level)
			) - player.getHealthValue(),
			response,
			reason: NumberChangeReason.CLASS,
			missionHealthParameter: {
				shouldPokeMission: false,
				overHealCountsForMission: false
			}
		});
		player.setEnergyLost(Math.ceil(
			player.fightPointsLost / oldClass.getMaxCumulativeEnergyValue(level) * newClass.getMaxCumulativeEnergyValue(level)
		), NumberChangeReason.CLASS, playerActiveObjects);
		await MissionsController.update(player, response, { missionId: "chooseClass" });
		await MissionsController.update(player, response, {
			missionId: "chooseClassTier",
			params: { tier: newClass.classGroup }
		});
		await player.save();
		crowniclesInstance?.logsDatabase.logPlayerClassChange(player.keycloakId, newClass.id)
			.then();

		response.push(makePacket(CommandClassesChangeSuccessPacket, {
			classId: selectedClass
		}));
	};
}

export default class ClassesCommand {
	@commandRequires(CommandClassesPacketReq, {
		notBlocked: true,
		allowedEffects: CommandUtils.ALLOWED_EFFECTS.NO_EFFECT,
		level: ClassConstants.REQUIRED_LEVEL,
		whereAllowed: [WhereAllowed.CONTINENT]
	})
	async execute(response: CrowniclesPacket[], player: Player, _packet: CommandClassesPacketReq, context: PacketContext): Promise<void> {
		const allClasses = ClassDataController.instance.getByGroup(player.getClassGroup())
			.filter(c => c.id !== player.class);
		const currentClass = ClassDataController.instance.getById(player.class);
		const currentClassGroup = currentClass!.classGroup;
		const lastTimeThePlayerHasEditedHisClass = await LogsReadRequests.getLastTimeThePlayerHasEditedHisClass(player.keycloakId);
		if (Date.now() - lastTimeThePlayerHasEditedHisClass.getTime() < secondsToMilliseconds(ClassConstants.TIME_BEFORE_CHANGE_CLASS[currentClassGroup])) {
			response.push(makePacket(CommandClassesCooldownErrorPacket, {
				timestamp: lastTimeThePlayerHasEditedHisClass.valueOf() + secondsToMilliseconds(ClassConstants.TIME_BEFORE_CHANGE_CLASS[currentClassGroup])
			}));
			return;
		}

		const collector = new ReactionCollectorChangeClass(
			allClasses.map(c => ({
				id: c.id,
				attack: c.getAttackValue(player.level),
				energy: c.getMaxCumulativeEnergyValue(player.level),
				defense: c.getDefenseValue(player.level),
				speed: c.getSpeedValue(player.level),
				initialBreath: c.baseBreath,
				maxBreath: c.maxBreath,
				breathRegen: c.breathRegen,
				health: c.getMaxHealthValue(player.level)
			} as ReactionCollectorChangeClassDetails)),
			ClassConstants.TIME_BEFORE_CHANGE_CLASS[currentClassGroup]
		);

		const packet = new ReactionCollectorInstance(
			collector,
			context,
			{
				allowedPlayerKeycloakIds: [player.keycloakId]
			},
			getEndCallback(player)
		)
			.block(player.keycloakId, BlockingConstants.REASONS.CLASS)
			.build();

		response.push(packet);
	}
}
