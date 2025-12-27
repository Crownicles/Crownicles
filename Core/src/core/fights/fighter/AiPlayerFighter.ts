import { Fighter } from "./Fighter";
import { Player } from "../../database/game/models/Player";
import { InventorySlots } from "../../database/game/models/InventorySlot";
import { PlayerActiveObjects } from "../../database/game/models/PlayerActiveObjects";
import { FightView } from "../FightView";
import { RandomUtils } from "../../../../../Lib/src/utils/RandomUtils";
import { Class } from "../../../data/Class";
import {
	FightAction, FightActionDataController
} from "../../../data/FightAction";
import { CrowniclesPacket } from "../../../../../Lib/src/packets/CrowniclesPacket";
import {
	ClassBehavior, getAiClassBehavior
} from "../AiBehaviorController";
import PetEntity, { PetEntities } from "../../database/game/models/PetEntity";
import { FighterStatus } from "../FighterStatus";
import { Potion } from "../../../data/Potion";
import { checkDrinkPotionMissions } from "../../utils/ItemUtils";
import {
	FightConstants, FightRole
} from "../../../../../Lib/src/constants/FightConstants";
import { PetConstants } from "../../../../../Lib/src/constants/PetConstants";
import { PetUtils } from "../../utils/PetUtils";

type AiPlayerFighterOptions = {
	allowPotionConsumption?: boolean;
	preloadedActiveObjects?: PlayerActiveObjects;
	preloadedPetEntity?: PetEntity | null;
};

/**
 * Fighter
 * Class representing a player in a fight
 */
export class AiPlayerFighter extends Fighter {
	public player: Player;

	public pet?: PetEntity;

	private class: Class;

	private readonly classBehavior: ClassBehavior;

	private glory: number;

	private readonly allowPotionConsumption: boolean;

	private readonly preloadedActiveObjects?: PlayerActiveObjects;

	private readonly preloadedPetEntity?: PetEntity | null;

	private fightRole: FightRole = FightConstants.FIGHT_ROLES.DEFENDER;

	public constructor(player: Player, playerClass: Class, options: AiPlayerFighterOptions = {}) {
		super(player.level, FightActionDataController.instance.getListById(playerClass.fightActionsIds));
		this.player = player;
		this.class = playerClass;
		this.classBehavior = getAiClassBehavior(playerClass.id);
		this.allowPotionConsumption = options.allowPotionConsumption ?? true;
		this.preloadedActiveObjects = options.preloadedActiveObjects;
		this.preloadedPetEntity = options.preloadedPetEntity;
	}

	/**
	 * Set the fight role (attacker or defender)
	 * This affects whether the pet can participate if on expedition
	 * @param role The role of the fighter in this fight
	 */
	public setFightRole(role: FightRole): void {
		this.fightRole = role;
	}

	/**
	 * Function called when the fight starts
	 * @param fightView The fight view
	 * @param startStatus The first status of a player
	 * @param response The response packets
	 */
	async startFight(_fightView: FightView, startStatus: FighterStatus, response: CrowniclesPacket[]): Promise<void> {
		this.status = startStatus;
		await this.consumePotionIfNeeded(response);
	}

	/**
	 * Delete the potion from the inventory of the player if needed
	 * @param response
	 */
	public async consumePotionIfNeeded(response: CrowniclesPacket[]): Promise<void> {
		if (!this.allowPotionConsumption) {
			return;
		}
		const inventorySlots = await InventorySlots.getOfPlayer(this.player.id);
		const potionSlot = inventorySlots.find(slot => slot.isPotion() && slot.isEquipped());
		if (!potionSlot) {
			return;
		}

		const drankPotion = potionSlot.getItem() as Potion;
		if (!drankPotion.isFightPotion()) {
			return;
		}
		let currentUsages = potionSlot.usagesPotionAiFight;
		if (currentUsages === undefined || currentUsages === null || currentUsages <= 0) {
			currentUsages = drankPotion.usages || 1;
		}
		currentUsages--;
		if (currentUsages > 0) {
			potionSlot.usagesPotionAiFight = currentUsages;
			await potionSlot.save();
		}
		else {
			await this.player.drinkPotion(potionSlot.slot);
			await this.player.save();
		}
		await checkDrinkPotionMissions(response, this.player, drankPotion, await InventorySlots.getOfPlayer(this.player.id));
	}


	/**
	 * Load the pet entity for the fighter based on availability
	 */
	private async loadPetEntity(): Promise<void> {
		if (!this.player.petId) {
			this.pet = undefined;
			return;
		}

		if (this.preloadedPetEntity !== undefined) {
			this.pet = this.preloadedPetEntity;
			return;
		}

		// Check if pet is available based on fight role
		const petAvailabilityContext = this.fightRole === FightConstants.FIGHT_ROLES.ATTACKER
			? PetConstants.AVAILABILITY_CONTEXT.ATTACK_FIGHT
			: PetConstants.AVAILABILITY_CONTEXT.DEFENSE_FIGHT;
		const isPetAvailable = await PetUtils.isPetAvailable(this.player, petAvailabilityContext);
		this.pet = isPetAvailable ? await PetEntities.getById(this.player.petId) : undefined;
	}

	/**
	 * The fighter loads its various stats
	 */
	public async loadStats(): Promise<void> {
		const playerActiveObjects: PlayerActiveObjects = this.preloadedActiveObjects ?? await InventorySlots.getPlayerActiveObjects(this.player.id);
		this.stats.energy = this.player.getMaxCumulativeEnergy();
		this.stats.maxEnergy = this.player.getMaxCumulativeEnergy();
		this.stats.attack = this.player.getCumulativeAttack(playerActiveObjects);
		this.stats.defense = this.player.getCumulativeDefense(playerActiveObjects);
		this.stats.speed = this.player.getCumulativeSpeed(playerActiveObjects);
		this.stats.breath = this.player.getBaseBreath();
		this.stats.maxBreath = this.player.getMaxBreath();
		this.stats.breathRegen = this.player.getBreathRegen();
		this.glory = this.player.getGloryPoints();
		await this.loadPetEntity();
	}

	/**
	 * Send the embed to choose an action
	 * @param fightView
	 * @param response
	 */
	async chooseAction(fightView: FightView, response: CrowniclesPacket[]): Promise<void> {
		fightView.displayAiChooseAction(response, RandomUtils.randInt(800, 2500));

		const classBehavior = this.classBehavior;

		// Use the behavior script to choose an action
		let fightAction: FightAction;

		if (classBehavior) {
			fightAction = classBehavior.chooseAction(this, fightView);
		}
		else {
			// Fallback to a simple attack if no behavior is defined
			fightAction = FightActionDataController.instance.getById("simpleAttack");
		}
		await fightView.fightController.executeFightAction(fightAction, true, response);
	}

	endFight(_winner: boolean, _response: CrowniclesPacket[], _bug: boolean, _turnCount: number): Promise<void> {
		return Promise.resolve();
	}

	unblock(): void {
		// Not needed for AI players, they are not blocked during the fight
	}
}
