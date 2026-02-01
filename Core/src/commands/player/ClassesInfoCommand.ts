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

export default class ClassesInfoCommand {
	@commandRequires(CommandClassesInfoPacketReq, {
		notBlocked: false,
		disallowedEffects: CommandUtils.DISALLOWED_EFFECTS.NOT_STARTED_OR_DEAD,
		level: ClassConstants.REQUIRED_LEVEL,
		whereAllowed: [WhereAllowed.CONTINENT]
	})
	execute(response: CrowniclesPacket[], player: Player): void {
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

		response.push(makePacket(CommandClassesInfoPacketRes, {
			data: {
				classesStats: classesLineDisplay
			}
		}));
	}
}
