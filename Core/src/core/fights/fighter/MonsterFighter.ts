import { Fighter } from "./Fighter";
import { FightView } from "../FightView";
import { RandomUtils } from "../../../../../Lib/src/utils/RandomUtils";
import { PVEConstants } from "../../../../../Lib/src/constants/PVEConstants";
import { FighterStatus } from "../FighterStatus";
import { Monster } from "../../../data/Monster";
import {
	FightAction, FightActionDataController
} from "../../../data/FightAction";
import { CrowniclesPacket } from "../../../../../Lib/src/packets/CrowniclesPacket";

export class MonsterFighter extends Fighter {
	public readonly monster: Monster;

	public constructor(level: number, monster: Monster) {
		const attacks: FightAction[] = [];
		for (const attack of monster.attacks) {
			if (level >= attack.minLevel) {
				const monsterAttackToAdd = FightActionDataController.instance.getById(attack.id);
				monsterAttackToAdd.setWeightForRandomSelection(attack.weight);
				attacks.push(monsterAttackToAdd);
			}
		}
		super(level, attacks);
		this.stats.energy = this.levelToEnergy(level, monster.baseEnergyValue);
		this.stats.maxEnergy = this.stats.energy;
		this.stats.attack = this.calculateStat(PVEConstants.STATS_FORMULA.ATTACK, level, monster.attackRatio);
		this.stats.defense = this.calculateStat(PVEConstants.STATS_FORMULA.DEFENSE, level, monster.defenseRatio);
		this.stats.speed = this.calculateStat(PVEConstants.STATS_FORMULA.SPEED, level, monster.speedRatio);
		this.stats.breath = monster.breath;
		this.stats.maxBreath = monster.maxBreath;
		this.stats.breathRegen = monster.breathRegen;
		this.monster = monster;
		this.status = FighterStatus.NOT_STARTED;
	}

	levelToEnergy(level: number, baseEnergyValue: number): number {
		return Math.round(baseEnergyValue + (2000 / (1 + Math.exp(-0.06 * (level - 45))) + 0.7 * (level - 17)));
	}

	calculateStat(stat: {
		A: number; B: number; C: number;
	}, level: number, ratio: number): number {
		return Math.round(Math.round(stat.A * level * level + stat.B * level + stat.C) * ratio / 100.0);
	}

	async chooseAction(fightView: FightView, response: CrowniclesPacket[]): Promise<void> {
		fightView.displayAiChooseAction(response, RandomUtils.randInt(300, 1800));

		const fightAction = this.getRandomAvailableFightAction();
		await fightView.fightController.executeFightAction(fightAction, true, response);
	}

	endFight(_winner: boolean, _response: CrowniclesPacket[], _bug: boolean, _turnCount: number): Promise<void> {
		return Promise.resolve();
	}

	startFight(_fightView: FightView, _startStatus: FighterStatus, _response: CrowniclesPacket[]): Promise<void> {
		return Promise.resolve();
	}

	unblock(): void {
		// Do nothing
	}
}
