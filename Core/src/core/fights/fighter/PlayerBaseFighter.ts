import { Fighter } from "./Fighter";
import { Player } from "../../database/game/models/Player";
import {
	InventorySlot, InventorySlots
} from "../../database/game/models/InventorySlot";
import { Potion } from "../../../data/Potion";
import { CrowniclesPacket } from "../../../../../Lib/src/packets/CrowniclesPacket";
import { checkDrinkPotionMissions } from "../../utils/ItemUtils";
import PetEntity from "../../database/game/models/PetEntity";
import { FightAction } from "../../../data/FightAction";
import {
	FightConstants, FightRole
} from "../../../../../Lib/src/constants/FightConstants";

/**
 * Base class for player fighters (human-controlled or AI)
 * Contains shared logic for potion consumption and pet handling
 */
export abstract class PlayerBaseFighter extends Fighter {
	public player: Player;

	public pet?: PetEntity;

	protected fightRole: FightRole = FightConstants.FIGHT_ROLES.ATTACKER;

	protected constructor(player: Player, availableFightActions: FightAction[]) {
		super(player.level, availableFightActions);
		this.player = player;
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
	 * Get the current remaining usages for a potion slot
	 * @param potionSlot The inventory slot containing the potion
	 * @param potion The potion data
	 * @returns The current remaining usages
	 */
	protected getRemainingUsages(potionSlot: InventorySlot, potion: Potion): number {
		const storedUsages = potionSlot.remainingPotionUsages;
		if (storedUsages && storedUsages > 0) {
			return storedUsages;
		}
		return potion.usages || 1;
	}

	/**
	 * Consume a fight potion if applicable, decrementing usage count
	 * @param response The response packets
	 * @param skipProbability Probability that the potion consumption will be skipped (0 = always consume, 1 = never consume)
	 */
	protected async consumeFightPotionIfNeeded(response: CrowniclesPacket[], skipProbability: number): Promise<void> {
		if (Math.random() < skipProbability) {
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

		const currentUsages = this.getRemainingUsages(potionSlot, drankPotion) - 1;
		if (currentUsages > 0) {
			potionSlot.remainingPotionUsages = currentUsages;
			await potionSlot.save();
		}
		else {
			await this.player.drinkPotion(potionSlot.slot);
			await this.player.save();
		}
		await checkDrinkPotionMissions(response, this.player, drankPotion, inventorySlots);
	}
}
