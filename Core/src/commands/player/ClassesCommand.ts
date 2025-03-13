import {commandRequires, CommandUtils} from "../../core/utils/CommandUtils";
import {DraftBotPacket, makePacket, PacketContext} from "../../../../Lib/src/packets/DraftBotPacket";
import Player from "../../core/database/game/models/Player";
import {
	CommandClassesCancelErrorPacket, CommandClassesChangeSuccessPacket,
	CommandClassesCooldownErrorPacket,
	CommandClassesPacketReq
} from "../../../../Lib/src/packets/commands/CommandClassesPacket";
import {Constants} from "../../../../Lib/src/constants/Constants";
import {ClassDataController} from "../../data/Class";
import {LogsReadRequests} from "../../core/database/logs/LogsReadRequests";
import {millisecondsToSeconds} from "../../../../Lib/src/utils/TimeUtils";
import {ReactionCollectorInstance} from "../../core/utils/ReactionsCollector";
import {BlockingConstants} from "../../../../Lib/src/constants/BlockingConstants";
import {
	ReactionCollectorChangeClass,
	ReactionCollectorChangeClassDetails, ReactionCollectorChangeClassReaction
} from "../../../../Lib/src/packets/interaction/ReactionCollectorChangeClass";
import {BlockingUtils} from "../../core/utils/BlockingUtils";
import {ReactionCollectorRefuseReaction} from "../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import {NumberChangeReason} from "../../../../Lib/src/constants/LogsConstants";
import {MissionsController} from "../../core/missions/MissionsController";
import {draftBotInstance} from "../../index";

function getEndCallback(player: Player) {
	return async (collector: ReactionCollectorInstance, response: DraftBotPacket[]): Promise<void> => {
		BlockingUtils.unblockPlayer(player.id, BlockingConstants.REASONS.CLASS);

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

		player.class = selectedClass;
		await player.addHealth(Math.ceil(
			player.health / oldClass.getMaxHealthValue(level) * newClass.getMaxHealthValue(level)
		) - player.health, response, NumberChangeReason.CLASS, {
			shouldPokeMission: false,
			overHealCountsForMission: false
		});
		player.setFightPointsLost(Math.ceil(
			player.fightPointsLost / oldClass.getMaxCumulativeFightPointValue(level) * newClass.getMaxCumulativeFightPointValue(level)
		), NumberChangeReason.CLASS);
		await MissionsController.update(player, response, {missionId: "chooseClass"});
		await MissionsController.update(player, response, {
			missionId: "chooseClassTier",
			params: {tier: newClass.classGroup}
		});
		await player.save();
		draftBotInstance.logsDatabase.logPlayerClassChange(player.keycloakId, newClass.id).then();

		response.push(makePacket(CommandClassesChangeSuccessPacket, {
			classId: selectedClass
		}));
	};
}

export default class ClassesCommand {
	@commandRequires(CommandClassesPacketReq, {
		notBlocked: true,
		allowedEffects: CommandUtils.ALLOWED_EFFECTS.NO_EFFECT,
		level: Constants.CLASS.REQUIRED_LEVEL
	})
	async execute(response: DraftBotPacket[], player: Player, _packet: CommandClassesPacketReq, context: PacketContext): Promise<void> {
		const allClasses = ClassDataController.instance.getByGroup(player.getClassGroup()).filter(c => c.id !== player.class);
		const currentClassGroup = ClassDataController.instance.getById(player.class).classGroup;
		const lastTimeThePlayerHasEditedHisClass = await LogsReadRequests.getLastTimeThePlayerHasEditedHisClass(player.keycloakId);
		if (millisecondsToSeconds(Date.now()) - lastTimeThePlayerHasEditedHisClass.getTime() < Constants.CLASS.TIME_BEFORE_CHANGE_CLASS[currentClassGroup]) {
			response.push(makePacket(CommandClassesCooldownErrorPacket, {
				timestamp: lastTimeThePlayerHasEditedHisClass.getTime() + Constants.CLASS.TIME_BEFORE_CHANGE_CLASS[currentClassGroup] * 1000
			}));
			return;
		}

		const collector = new ReactionCollectorChangeClass(
			allClasses.map(c => ({
				id: c.id,
				attack: c.getAttackValue(player.level),
				energy: c.getMaxCumulativeFightPointValue(player.level),
				defense: c.getDefenseValue(player.level),
				speed: c.getSpeedValue(player.level),
				initialBreath: c.baseBreath,
				maxBreath: c.maxBreath,
				breathRegen: c.breathRegen,
				health: c.getMaxHealthValue(player.level)
			} as ReactionCollectorChangeClassDetails)),
			Constants.CLASS.TIME_BEFORE_CHANGE_CLASS[currentClassGroup],
			player.class
		);

		const packet = new ReactionCollectorInstance(
			collector,
			context,
			{
				allowedPlayerKeycloakIds: [player.keycloakId]
			},
			getEndCallback(player)
		)
			.block(player.id, BlockingConstants.REASONS.CLASS)
			.build();

		response.push(packet);
	}
}