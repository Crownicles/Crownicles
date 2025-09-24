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
import { InventorySlots } from "../../core/database/game/models/InventorySlot";

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
		const activeObjects = await InventorySlots.getPlayerActiveObjects(player.id);
		const healthBefore = player.getHealth(activeObjects);

		player.class = selectedClass;
		await player.addHealth(Math.ceil(
			healthBefore / oldClass.getMaxHealthValue(level) * newClass.getMaxHealthValue(level)
		) - healthBefore, response, NumberChangeReason.CLASS, activeObjects, {
			shouldPokeMission: false,
			overHealCountsForMission: false
		});
		player.setEnergyLost(Math.ceil(
			player.fightPointsLost / oldClass.getMaxCumulativeEnergyValue(level) * newClass.getMaxCumulativeEnergyValue(level)
		), NumberChangeReason.CLASS, activeObjects);
		await MissionsController.update(player, response, { missionId: "chooseClass" });
		await MissionsController.update(player, response, {
			missionId: "chooseClassTier",
			params: { tier: newClass.classGroup }
		});
		await player.save();
		crowniclesInstance.logsDatabase.logPlayerClassChange(player.keycloakId, newClass.id)
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
		const currentClassGroup = ClassDataController.instance.getById(player.class).classGroup;
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
