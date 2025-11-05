import { FighterStatus } from "../FighterStatus";
import { FightView } from "../FightView";
import { RandomUtils } from "../../../../../Lib/src/utils/RandomUtils";
import { PVEConstants } from "../../../../../Lib/src/constants/PVEConstants";
import { FightStatModifierOperation } from "../../../../../Lib/src/types/FightStatModifierOperation";
import { FightAlteration } from "../../../data/FightAlteration";
import { FightAction } from "../../../data/FightAction";
import { CrowniclesPacket } from "../../../../../Lib/src/packets/CrowniclesPacket";
import { FightConstants } from "../../../../../Lib/src/constants/FightConstants";
import { FightActionType } from "../../../../../Lib/src/types/FightActionType";

type FighterStats = {
	energy: number;
	maxEnergy: number;
	speed: number;
	defense: number;
	attack: number;
	breath: number;
	maxBreath: number;
	breathRegen: number;
};

export type FightStatModifier = {
	origin: FightAction;
	operation: FightStatModifierOperation;
	value: number;
};

type FightDamageMultiplier = {
	value: number;
	turns: number;
};

type FightTypeResistance = {
	type: FightActionType;
	value: number;
	turns: number;
	reflectDamage?: boolean;
};

export abstract class Fighter {
	public nextFightAction: FightAction;

	public fightActionsHistory: (FightAction | FightAlteration)[];

	public availableFightActions: Map<string, FightAction>;

	public alterationTurn: number;

	public readonly level: number;

	public alteration: FightAlteration;

	protected stats: FighterStats;

	protected status: FighterStatus;

	private attackModifiers: FightStatModifier[];

	private defenseModifiers: FightStatModifier[];

	private speedModifiers: FightStatModifier[];

	private resistances: FightTypeResistance[];

	private ready: boolean;

	private damageMultipliers: FightDamageMultiplier[];

	protected constructor(level: number, availableFightActions: FightAction[]) {
		this.stats = {
			energy: null,
			maxEnergy: null,
			speed: null,
			defense: null,
			attack: null,
			breath: null,
			maxBreath: null,
			breathRegen: null
		};
		this.attackModifiers = [];
		this.defenseModifiers = [];
		this.speedModifiers = [];
		this.ready = false;
		this.nextFightAction = null;
		this.fightActionsHistory = [];
		this.status = FighterStatus.NOT_STARTED_PLAYER;
		this.alteration = null;
		this.alterationTurn = 0;
		this.level = level;
		this.damageMultipliers = [];
		this.resistances = [];

		this.availableFightActions = new Map();
		for (const fightAction of availableFightActions) {
			this.availableFightActions.set(fightAction.id, fightAction);
		}
	}

	/**
	 * Make the fighter choose his next action
	 * @param fightView
	 * @param response
	 */
	abstract chooseAction(fightView: FightView, response: CrowniclesPacket[]): Promise<void>;

	/**
	 * Function called when the fight starts
	 * @param fightView
	 * @param startStatus
	 * @param response
	 */
	abstract startFight(fightView: FightView, startStatus: FighterStatus, response: CrowniclesPacket[]): Promise<void>;

	/**
	 * Function called when the fight ends
	 * @param winner Indicate if the fighter is the winner
	 * @param response
	 * @param bug - Indicate if the fighter is buggy
	 */
	abstract endFight(winner: boolean, response: CrowniclesPacket[], bug: boolean, turnCount: number): Promise<void>;

	/**
	 * Allow the fighter to unblock himself
	 */
	abstract unblock(): void;

	/**
	 * Set the status of the fighter
	 * @param newStatus
	 */
	setStatus(newStatus: FighterStatus): void {
		this.status = newStatus;
	}

	/**
	 * Get fighter attack
	 */
	public getAttack(): number {
		return this.calculateModifiedStat(this.stats.attack, this.attackModifiers);
	}

	/**
	 * Get fighter defense
	 */
	public getDefense(): number {
		return this.calculateModifiedStat(this.stats.defense, this.defenseModifiers);
	}

	/**
	 * Get fighter speed
	 */
	public getSpeed(): number {
		return this.calculateModifiedStat(this.stats.speed, this.speedModifiers);
	}

	/**
	 * Get energy
	 */
	public getEnergy(): number {
		return this.stats.energy;
	}

	/**
	 * Get the maximum energy
	 */
	public getMaxEnergy(): number {
		return this.stats.maxEnergy;
	}

	/**
	 * Get the breath of the fighter
	 */
	public getBreath(): number {
		return this.stats.breath;
	}

	/**
	 * Get the maximum breath of the fighter
	 */
	public getMaxBreath(): number {
		return this.stats.maxBreath;
	}

	/**
	 * Get the regeneration amount breath of the fighter per turn
	 */
	public getRegenBreath(): number {
		return this.stats.breathRegen;
	}

	/**
	 * Add (or remove if negative) breath to the fighter
	 * @param value The new breath
	 */
	public addBreath(value: number): number {
		this.stats.breath += value;
		if (this.stats.breath < 0) {
			this.stats.breath = 0;
		}
		else if (this.stats.breath > this.stats.maxBreath) {
			this.stats.breath = this.stats.maxBreath;
		}
		return this.stats.breath;
	}

	/**
	 *Set the breath of the fighter
	 * @param value The new breath
	 */
	public setBreath(value: number): void {
		this.stats.breath = value;
	}

	/**
	 * Set the base energy of the fighter
	 * @param value
	 */
	public setBaseEnergy(value: number): void {
		this.stats.energy = value;
	}

	/**
	 * Apply an attack modifier
	 * @param modifier
	 */
	public applyAttackModifier(modifier: FightStatModifier): void {
		this.attackModifiers.push(modifier);
	}

	/**
	 * Apply a defense modifier
	 * @param modifier
	 */
	public applyDefenseModifier(modifier: FightStatModifier): void {
		this.defenseModifiers.push(modifier);
	}

	/**
	 * Apply a speed modifier
	 * @param modifier
	 */
	public applySpeedModifier(modifier: FightStatModifier): void {
		this.speedModifiers.push(modifier);
	}

	public applyResistance(resistance: FightTypeResistance): void {
		this.resistances.push(resistance);
	}

	/**
	 * Remove all attack modifiers for an origin
	 * @param origin
	 */
	public removeAttackModifiers(origin: FightAction): void {
		this.attackModifiers = this.attackModifiers.filter(modifier => modifier.origin !== origin);
	}

	/**
	 * Remove all defense modifiers for an origin
	 * @param origin
	 */
	public removeDefenseModifiers(origin: FightAction): void {
		this.defenseModifiers = this.defenseModifiers.filter(modifier => modifier.origin !== origin);
	}

	/**
	 * Remove all speed modifiers for an origin
	 * @param origin
	 */
	public removeSpeedModifiers(origin: FightAction): void {
		this.speedModifiers = this.speedModifiers.filter(modifier => modifier.origin !== origin);
	}

	/**
	 * Check if the fighter has an attack modifier with an origin
	 * @param origin
	 */
	public hasAttackModifier(origin: FightAction): boolean {
		return this.attackModifiers.filter(modifier => modifier.origin === origin).length !== 0;
	}

	/**
	 * Check if the fighter has a defense modifier with an origin
	 * @param origin
	 */
	public hasDefenseModifier(origin: FightAction): boolean {
		return this.defenseModifiers.filter(modifier => modifier.origin === origin).length !== 0;
	}

	/**
	 * Check if the fighter has a speed modifier with an origin
	 * @param origin
	 */
	public hasSpeedModifier(origin: FightAction): boolean {
		return this.speedModifiers.filter(modifier => modifier.origin === origin).length !== 0;
	}

	/**
	 * Apply a multiplier which multiply the total damages of the fighter
	 * @param multiplier
	 * @param turns The number of turns it lasts
	 */
	public applyDamageMultiplier(multiplier: number, turns: number): void {
		this.damageMultipliers.push({
			value: multiplier,
			turns
		});
	}

	/**
	 * Get the damage multiplier
	 */
	public getDamageMultiplier(): number {
		let multiplier = 1;

		for (const damageMultiplier of this.damageMultipliers) {
			multiplier *= damageMultiplier.value;
		}

		return multiplier;
	}

	public getResistanceMultiplier(type: FightActionType): number {
		let multiplier = 1;
		for (const resistance of this.resistances) {
			if (resistance.type === type) {
				multiplier *= 1 - resistance.value;
			}
		}
		return multiplier;
	}

	public getReflectedDamage(type: FightActionType, originalDamage: number): number {
		let reflectedDamage = 0;
		for (const resistance of this.resistances) {
			if (resistance.type === type && resistance.reflectDamage) {
				reflectedDamage += Math.round(originalDamage * resistance.value);
			}
		}
		return reflectedDamage;
	}


	/**
	 * Damage the fighter
	 * @param value
	 * @returns The new value of energy
	 */
	public damage(value: number): number {
		// Return current energy if no damage value
		if (!value) {
			return this.stats.energy;
		}

		// Apply damage
		this.stats.energy = Math.max(0, this.stats.energy - value);

		return this.stats.energy;
	}

	/**
	 * Heal the fighter
	 * @param value
	 * @returns The new value of energy
	 */
	public heal(value: number): number {
		this.stats.energy += value;
		const max = this.getMaxEnergy();
		if (this.stats.energy > max) {
			this.stats.energy = max;
		}
		return this.stats.energy;
	}

	/**
	 * Check if the player is dead
	 */
	public isDead(): boolean {
		return this.getEnergy() <= 0;
	}

	/**
	 * Check if the player is dead or buggy
	 */
	public isDeadOrBug(): boolean {
		return this.isDead() || this.status === FighterStatus.BUG;
	}

	/**
	 * The name of the function is very clear
	 */
	public kill(): void {
		this.stats.energy = 0;
	}

	/**
	 * Get a map of the fight actions executed and the amount of time it has been done
	 */
	public getFightActionCount(): Map<string, number> {
		const playerFightActionsHistory = new Map<string, number>();
		this.fightActionsHistory.forEach(action => {
			if (playerFightActionsHistory.has(action.id)) {
				playerFightActionsHistory.set(action.id, playerFightActionsHistory.get(action.id) + 1);
			}
			else {
				playerFightActionsHistory.set(action.id, 1);
			}
		});
		return playerFightActionsHistory;
	}

	/**
	 * Check if the fighter has a fight alteration
	 */
	hasFightAlteration(): boolean {
		return this.alteration !== null;
	}

	/**
	 * Set a new fight alteration to the fighter
	 * @param alteration - the new fight alteration
	 * returns the FighterAlterationId of the fight alteration that was set or kept
	 */
	newAlteration(alteration: FightAlteration): FightAlteration {
		if (this.alteration === null || this.alteration === alteration) {
			this.alterationTurn = 0;
		}
		if (this.alteration === null || alteration === null) {
			// Check for alteration conflict
			this.alteration = alteration;
		}
		return this.alteration;
	}

	/**
	 * Remove the player alteration
	 */
	removeAlteration(): void {
		this.alterationTurn = 0;
		this.alteration = null;
	}

	/**
	 * Get a random fight action id from the list of available fight actions for a fighter
	 */
	getRandomAvailableFightAction(): FightAction {
		const attacks = Array.from(this.availableFightActions.values());
		let availableAttacks = attacks.filter(action => action.breath <= this.getBreath()
			|| RandomUtils.crowniclesRandom.realZeroToOneInclusive() < PVEConstants.OUT_OF_BREATH_CHOOSE_PROBABILITY);

		availableAttacks = availableAttacks.length === 0 ? attacks : availableAttacks;

		// Calculate total weight
		const totalWeight = availableAttacks.reduce((sum, attack) => sum + attack.getWeightForRandomSelection(), 0);

		// If no weights are set (total weight is 0, NaN, or undefined), use uniform random selection
		if (totalWeight === 0 || isNaN(totalWeight)) {
			const randomIndex = RandomUtils.crowniclesRandom.integer(0, availableAttacks.length - 1);
			return availableAttacks[randomIndex];
		}

		// Use weighted random selection when weights are properly set
		let selectedAttack = availableAttacks[0]; // Default value
		let random = RandomUtils.crowniclesRandom.realZeroToOneInclusive() * totalWeight;

		for (const attack of availableAttacks) {
			random -= attack.getWeightForRandomSelection();
			if (random <= 0) {
				selectedAttack = attack;
				break;
			}
		}
		return selectedAttack;
	}

	/**
	 * Get the last fight action used by a fighter (excluding alteration)
	 */
	getLastFightActionUsed(): FightAction | null {
		if (this.fightActionsHistory.length === 0) {
			return null;
		}
		const lastAction = this.fightActionsHistory[this.fightActionsHistory.length - 1];

		// If the last action is a FightAlteration and is the OutOfBreath alteration, return null
		if (lastAction instanceof FightAlteration && lastAction.id === FightConstants.FIGHT_ACTIONS.ALTERATION.OUT_OF_BREATH) {
			return null;
		}

		// If the last action is a FightAlteration (but not OutOfBreath), return the previous action
		return lastAction instanceof FightAlteration ? this.fightActionsHistory[this.fightActionsHistory.length - 2] : lastAction;
	}

	/**
	 * Remove the breathCost of a fight action from the fighter if possible. Returns true if the breath cost has been removed
	 * @param breathCost
	 */
	useBreath(breathCost: number): boolean {
		if (this.stats.breath >= breathCost) {
			this.stats.breath -= breathCost;
			return true;
		}
		return false;
	}

	/**
	 * Add the breathRegen of the fighter to its breath
	 * @param half - if true, the breath regeneration is divided by 2
	 */
	regenerateBreath(half: boolean): void {
		this.stats.breath += half ? Math.ceil(this.stats.breathRegen / 2) : this.stats.breathRegen;
		if (this.stats.breath > this.stats.maxBreath) {
			this.stats.breath = this.stats.maxBreath;
		}
	}

	/**
	 * Lowers the current counters by one turn
	 */
	reduceCounters(): void {
		this.damageMultipliers = this.damageMultipliers.filter(damageMultiplier => {
			damageMultiplier.turns--;
			return damageMultiplier.turns > 0;
		});

		this.resistances = this.resistances.filter(resistance => {
			resistance.turns--;
			return resistance.turns > 0;
		});
	}

	/**
	 * Get the base stats
	 */
	public getBaseStats(): FighterStats {
		return this.stats;
	}

	private calculateModifiedStat(base: number, modifiers: FightStatModifier[]): number {
		let value = base;
		for (const modifier of modifiers) {
			switch (modifier.operation) {
				case FightStatModifierOperation.ADDITION:
					value += modifier.value;
					break;
				case FightStatModifierOperation.MULTIPLIER:
					value *= modifier.value;
					break;
				case FightStatModifierOperation.SET_VALUE:
					value = modifier.value;
					return Math.round(value);
				default:
					break;
			}
		}

		return Math.round(value);
	}
}
