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
import { FightConstants } from "../../../../../Lib/src/constants/FightConstants";

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

	public constructor(player: Player, playerClass: Class) {
		super(player.level, FightActionDataController.instance.getListById(playerClass.fightActionsIds));
		this.player = player;
		this.class = playerClass;
		this.classBehavior = getAiClassBehavior(playerClass.id);
	}

	/**
	 * Function called when the fight starts
	 * @param fightView The fight view
	 * @param startStatus The first status of a player
	 */
	async startFight(fightView: FightView, startStatus: FighterStatus): Promise<void> {
		this.status = startStatus;
		await this.consumePotionIfNeeded([fightView.context]);
	}

	/**
	 * Delete the potion from the inventory of the player if needed
	 * @param response
	 */
	public async consumePotionIfNeeded(response: CrowniclesPacket[]): Promise<void> {
		// Potions have a chance of not being consumed
		if (RandomUtils.crowniclesRandom.realZeroToOneInclusive() < FightConstants.POTION_NO_DRINK_PROBABILITY.AI) {
			return;
		}
		const inventorySlots = await InventorySlots.getOfPlayer(this.player.id);
		const drankPotion = inventorySlots.find(slot => slot.isPotion() && slot.isEquipped())
			.getItem() as Potion;
		if (!drankPotion.isFightPotion()) {
			return;
		}
		await this.player.drinkPotion();
		await this.player.save();
		await checkDrinkPotionMissions(response, this.player, drankPotion, await InventorySlots.getOfPlayer(this.player.id));
	}


	/**
	 * The fighter loads its various stats
	 */
	public async loadStats(): Promise<void> {
		const playerActiveObjects: PlayerActiveObjects = await InventorySlots.getPlayerActiveObjects(this.player.id);
		this.stats.energy = this.player.getMaxCumulativeEnergy();
		this.stats.maxEnergy = this.player.getMaxCumulativeEnergy();
		this.stats.attack = this.player.getCumulativeAttack(playerActiveObjects);
		this.stats.defense = this.player.getCumulativeDefense(playerActiveObjects);
		this.stats.speed = this.player.getCumulativeSpeed(playerActiveObjects);
		this.stats.breath = this.player.getBaseBreath();
		this.stats.maxBreath = this.player.getMaxBreath();
		this.stats.breathRegen = this.player.getBreathRegen();
		this.glory = this.player.getGloryPoints();
		if (this.player.petId) {
			this.pet = await PetEntities.getById(this.player.petId);
		}
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

	endFight(): Promise<void> {
		return Promise.resolve();
	}

	unblock(): void {
		// Not needed for AI players, they are not blocked during the fight
	}
}
