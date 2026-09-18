import {
	CrowniclesPacket, makePacket
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandClassesInfoPacketReq,
	CommandClassesInfoPacketRes
} from "../../../../Lib/src/packets/commands/CommandClassesInfoPacket";

import { ClassDataController } from "../../data/Class";
import { FightActionDataController } from "../../data/FightAction";
import {
	commandRequires, CommandUtils
} from "../../core/utils/CommandUtils";
import { ClassConstants } from "../../../../Lib/src/constants/ClassConstants";
import Player from "../../core/database/game/models/Player";
import { WhereAllowed } from "../../../../Lib/src/types/WhereAllowed";
import { LogsReadRequests } from "../../core/database/logs/LogsReadRequests";
import { secondsToMilliseconds } from "../../../../Lib/src/utils/TimeUtils";

/**
 * Mirrors the cooldown ClassesCommand enforces, so the front-end can announce it before asking.
 */
async function getNextChangeTimestamp(player: Player): Promise<number> {
	const currentClassGroup = ClassDataController.instance.getById(player.class)!.classGroup;
	const lastChange = await LogsReadRequests.getLastTimeThePlayerHasEditedHisClass(player.keycloakId);
	return lastChange.valueOf() + secondsToMilliseconds(ClassConstants.TIME_BEFORE_CHANGE_CLASS[currentClassGroup]);
}

export default class ClassesInfoCommand {
	@commandRequires(CommandClassesInfoPacketReq, {
		notBlocked: false,
		disallowedEffects: CommandUtils.DISALLOWED_EFFECTS.NOT_STARTED_OR_DEAD,
		level: ClassConstants.REQUIRED_LEVEL,
		whereAllowed: [WhereAllowed.CONTINENT]
	})
	async execute(response: CrowniclesPacket[], player: Player): Promise<void> {
		const classGroup = player.getClassGroup();
		const classes = ClassDataController.instance.getByGroup(classGroup);

		const classesLineDisplay = [];
		for (const classToShow of classes) {
			const stats = classToShow.getClassStats(player.level);

			const attacks = classToShow.fightActionsIds;
			const attackStats = FightActionDataController.instance.getListById(attacks);

			const attackList = [];
			for (const attack of attacks) {
				const attackStat = attackStats.find(attackStat => attackStat.id === attack)!;
				attackList.push({
					id: attack,
					cost: attackStat.breath
				});
			}
			classesLineDisplay.push({
				id: classToShow.id,
				stats,
				attacks: attackList
			});
		}

		const nextChangeTimestamp = await getNextChangeTimestamp(player);
		response.push(makePacket(CommandClassesInfoPacketRes, {
			data: {
				classesStats: classesLineDisplay,
				...nextChangeTimestamp > Date.now() ? { nextChangeTimestamp } : {}
			}
		}));
	}
}
