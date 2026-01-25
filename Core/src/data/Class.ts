import { DataControllerNumber } from "./DataController";
import { ClassStats } from "../../../Lib/src/types/ClassStats";
import { Data } from "./Data";
import { RandomUtils } from "../../../Lib/src/utils/RandomUtils";
import { ClassKind } from "../../../Lib/src/types/ClassKind";

export class Class extends Data<number> {
	public readonly attack!: number;

	public readonly baseBreath!: number;

	public readonly breathRegen!: number;

	public readonly classGroup!: number;

	public readonly defense!: number;

	public readonly fightPoint!: number;

	public readonly health!: number;

	public readonly maxBreath!: number;

	public readonly speed!: number;

	public readonly fightActionsIds!: string[];

	public readonly classKind!: ClassKind;


	public getClassStats(level: number): ClassStats {
		return {
			attack: this.getAttackValue(level),
			defense: this.getDefenseValue(level),
			speed: this.getSpeedValue(level),
			health: this.getMaxHealthValue(level),
			classGroup: this.classGroup,
			fightPoint: this.getMaxCumulativeEnergyValue(level),
			baseBreath: this.baseBreath,
			maxBreath: this.maxBreath,
			breathRegen: this.breathRegen,
			classKind: this.classKind
		};
	}

	/**
	 * Get the attack value of the class in the given level
	 * @param level
	 */
	public getAttackValue(level: number): number {
		return Math.round(this.attack + this.attack / 100 * level / 4 * level / 10);
	}

	/**
	 * Get the defense value of the class in the given level
	 * @param level
	 */
	public getDefenseValue(level: number): number {
		return Math.round(this.defense + this.defense / 100 * level / 4 * level / 10);
	}

	/**
	 * Get the speed value of the class in the given level
	 * @param level
	 */
	public getSpeedValue(level: number): number {
		return Math.round(this.speed + this.speed / 100 * level / 4 * level / 10);
	}

	/**
	 * Get the max cumulative energy value of the class in the given level
	 * @param level
	 */
	public getMaxCumulativeEnergyValue(level: number): number {
		return Math.round(this.fightPoint + (1600 / (1 + Math.exp(-0.06 * level + 2)) + 0.5 * level));
	}

	/**
	 * Get the max health value of the class in the given level
	 * @param level
	 */
	public getMaxHealthValue(level: number): number {
		return this.health + level;
	}
}

export class ClassDataController extends DataControllerNumber<Class> {
	static readonly instance: ClassDataController = new ClassDataController("classes");

	newInstance(): Class {
		return new Class();
	}

	getClassMaxId(): number {
		return this.data.size;
	}

	/**
	 * Get the classes by their group id
	 * @param classGroup
	 */
	public getByGroup(classGroup: number): Class[] {
		return this.getValuesArray()
			.filter(classInstance => classInstance.classGroup === classGroup);
	}

	getRandomClass(): Class {
		return RandomUtils.crowniclesRandom.pick(Array.from(this.data.values()));
	}
}
