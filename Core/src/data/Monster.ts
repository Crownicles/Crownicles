import { DataControllerString } from "./DataController";
import { Data } from "./Data";
import { RandomUtils } from "../../../Lib/src/utils/RandomUtils";
import { PVEConstants } from "../../../Lib/src/constants/PVEConstants";

export class Monster extends Data<string> {
	public readonly emoji!: string;

	public readonly baseEnergyValue!: number;

	public readonly attackRatio!: number;

	public readonly defenseRatio!: number;

	public readonly speedRatio!: number;

	public readonly breath!: number;

	public readonly maxBreath!: number;

	public readonly breathRegen!: number;

	public readonly rewardFactor!: number;

	public readonly attacks!: {
		id: string;
		minLevel: number;
		weight: number;
	}[];

	public readonly maps!: number[];


	/**
	 * Get the rewards of the monster
	 * @param level Monster's level
	 */
	public getRewards(level: number): {
		money: number;
		xp: number;
		guildScore: number;
		guildXp: number;
	} {
		return {
			money: Math.round(this.rewardFactor * (level * PVEConstants.FIGHT_REWARDS.MONEY_FACTOR + RandomUtils.crowniclesRandom.integer(0, PVEConstants.FIGHT_REWARDS.RANDOM_MAX_REWARD))),
			xp: Math.round(this.rewardFactor * (level * PVEConstants.FIGHT_REWARDS.XP_FACTOR + RandomUtils.crowniclesRandom.integer(0, PVEConstants.FIGHT_REWARDS.RANDOM_MAX_REWARD))),
			guildScore: Math.round(this.rewardFactor * (level * PVEConstants.FIGHT_REWARDS.GUILD_SCORE_FACTOR + RandomUtils.crowniclesRandom.integer(0, PVEConstants.FIGHT_REWARDS.RANDOM_MAX_REWARD))),
			guildXp: Math.round(this.rewardFactor * (level * PVEConstants.FIGHT_REWARDS.GUILD_XP_FACTOR + RandomUtils.crowniclesRandom.integer(0, PVEConstants.FIGHT_REWARDS.RANDOM_MAX_REWARD)))
		};
	}
}

export class MonsterDataController extends DataControllerString<Monster> {
	static readonly instance: MonsterDataController = new MonsterDataController("monsters");

	newInstance(): Monster {
		return new Monster();
	}

	public getRandomMonster(mapId = -1, seed = RandomUtils.crowniclesRandom.integer(1, 9999)): Monster {
		let availableMonsters = this.getValuesArray();

		if (mapId !== -1) {
			availableMonsters = availableMonsters.filter(monster => monster.maps.includes(mapId));
		}

		return availableMonsters[seed % availableMonsters.length];
	}
}
