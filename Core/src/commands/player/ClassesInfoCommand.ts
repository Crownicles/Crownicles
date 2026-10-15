import {
	CrowniclesPacket, makePacket
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	ClassInfo,
	CommandClassesInfoPacketReq,
	CommandClassesInfoPacketRes
} from "../../../../Lib/src/packets/commands/CommandClassesInfoPacket";

import {
	Class, ClassDataController
} from "../../data/Class";
import { FightActionDataController } from "../../data/FightAction";
import {
	commandRequires, CommandUtils
} from "../../core/utils/CommandUtils";
import { ClassConstants } from "../../../../Lib/src/constants/ClassConstants";
import Player from "../../core/database/game/models/Player";
import { WhereAllowed } from "../../../../Lib/src/types/WhereAllowed";
import { classChangeCooldownUntil } from "./ClassChangeCooldown";

function classInfo(classToShow: Class, level: number): ClassInfo {
	const attackStats = FightActionDataController.instance.getListById(classToShow.fightActionsIds);
	return {
		id: classToShow.id,
		stats: classToShow.getClassStats(level),
		attacks: classToShow.fightActionsIds.map(attack => ({
			id: attack,
			cost: attackStats.find(attackStat => attackStat.id === attack)!.breath
		}))
	};
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
		const playerClass = ClassDataController.instance.getById(player.class);
		const outsideTier = playerClass && !classes.some(offered => offered.id === playerClass.id) ? playerClass : null;

		const nextChangeTimestamp = await classChangeCooldownUntil(player);
		response.push(makePacket(CommandClassesInfoPacketRes, {
			data: {
				classesStats: classes.map(classToShow => classInfo(classToShow, player.level)),
				...outsideTier ? { currentClass: classInfo(outsideTier, player.level) } : {},
				...nextChangeTimestamp === null ? {} : { nextChangeTimestamp }
			}
		}));
	}
}
