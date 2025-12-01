import { Player } from "../../database/game/models/Player";
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
import { PlayerFighter } from "./PlayerFighter";
import { PlayerActiveObjects } from "../../database/game/models/PlayerActiveObjects";
import { InventorySlots } from "../../database/game/models/InventorySlot";
import { FightConstants } from "../../../../../Lib/src/constants/FightConstants";

type AiPlayerFighterOptions = {
	allowPotionConsumption?: boolean;
	preloadedActiveObjects?: PlayerActiveObjects;
	preloadedPetEntity?: PetEntity | null;
};

/**
 * Fighter
 * Class representing a player in a fight
 */
export class AiPlayerFighter extends PlayerFighter {
	public consumePotionProbability = FightConstants.POTION_NO_DRINK_PROBABILITY.AI;

	private readonly classBehavior: ClassBehavior;

	private readonly allowPotionConsumption: boolean;

	private readonly preloadedActiveObjects?: PlayerActiveObjects;

	private readonly preloadedPetEntity?: PetEntity | null;

	public constructor(player: Player, playerClass: Class, options: AiPlayerFighterOptions = {}) {
		super(player, playerClass);
		this.classBehavior = getAiClassBehavior(playerClass.id);
		this.allowPotionConsumption = options.allowPotionConsumption ?? true;
		this.preloadedActiveObjects = options.preloadedActiveObjects;
		this.preloadedPetEntity = options.preloadedPetEntity;
	}

	/**
	 * <<<<<<< HEAD
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
		if (!this.allowPotionConsumption) {
			return;
		}

		await super.consumePotionIfNeeded(response);
	}


	/**
	 * The fighter loads its various stats
	 */
	public async loadStats(): Promise<void> {
		const playerActiveObjects: PlayerActiveObjects = this.preloadedActiveObjects ?? await InventorySlots.getPlayerActiveObjects(this.player.id);
		this.stats.energy = this.player.getMaxCumulativeEnergy(playerActiveObjects);
		this.stats.maxEnergy = this.player.getMaxCumulativeEnergy(playerActiveObjects);
		this.stats.attack = this.player.getCumulativeAttack(playerActiveObjects);
		this.stats.defense = this.player.getCumulativeDefense(playerActiveObjects);
		this.stats.speed = this.player.getCumulativeSpeed(playerActiveObjects);
		this.stats.breath = this.player.getBaseBreath();
		this.stats.maxBreath = this.player.getMaxBreath();
		this.stats.breathRegen = this.player.getBreathRegen();
		if (this.player.petId) {
			if (this.preloadedPetEntity !== undefined) {
				this.pet = this.preloadedPetEntity;
			}
			else {
				this.pet = await PetEntities.getById(this.player.petId);
			}
		}
		else {
			this.pet = undefined;
		}
	}

	/**
	 * =======
	 * >>>>>>> b48bf566a (Implement items enchantments effects #3598)
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
