import { Fighter } from "./Fighter";
import { Player } from "../../database/game/models/Player";
import { InventorySlots } from "../../database/game/models/InventorySlot";
import { PlayerActiveObjects } from "../../database/game/models/PlayerActiveObjects";
import { FightView } from "../FightView";
import { RandomUtils } from "../../../../../Lib/src/utils/RandomUtils";
import { Class } from "../../../data/Class";
import { FightActionDataController } from "../../../data/FightAction";
import { CrowniclesPacket } from "../../../../../Lib/src/packets/CrowniclesPacket";
import PetEntity, { PetEntities } from "../../database/game/models/PetEntity";
import { FighterStatus } from "../FighterStatus";
import { Potion } from "../../../data/Potion";
import { checkDrinkPotionMissions } from "../../utils/ItemUtils";
import { FightConstants } from "../../../../../Lib/src/constants/FightConstants";
import {
	ItemEnchantment, ItemEnchantmentKind
} from "../../../../../Lib/src/types/ItemEnchantment";
import { EnchantmentConstants } from "../../../../../Lib/src/constants/EnchantmentConstants";

type OpponentType = "MonsterFighter" | "PlayerFighter";

/**
 * Fighter
 * Class representing a player in a fight
 */
export abstract class PlayerFighter extends Fighter {
	public player: Player;

	public pet?: PetEntity;

	protected constructor(player: Player, playerClass: Class) {
		super(player.level, FightActionDataController.instance.getListById(playerClass.fightActionsIds));
		this.player = player;
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

	private getItemAttackMultiplier(itemEnchantment: ItemEnchantment | null, opponentType: OpponentType): number {
		let multiplier = 1;

		if (opponentType === "PlayerFighter" && itemEnchantment?.kind === ItemEnchantmentKind.PVP_ATTACK) {
			multiplier *= EnchantmentConstants.PVP_ATTACK_MULTIPLIER[itemEnchantment.level - 1];
		}
		else if (opponentType === "MonsterFighter" && itemEnchantment?.kind === ItemEnchantmentKind.PVE_ATTACK) {
			multiplier *= EnchantmentConstants.PVE_ATTACK_MULTIPLIER[itemEnchantment.level - 1];
		}
		if (itemEnchantment?.kind === ItemEnchantmentKind.ALL_ATTACK) {
			multiplier *= EnchantmentConstants.ALL_ATTACK_MULTIPLIER[itemEnchantment.level - 1];
		}

		return multiplier;
	}

	private getAttackMultiplier(weaponEnchantment: ItemEnchantment | null, armorEnchantment: ItemEnchantment | null, opponentType: OpponentType): number {
		return this.getItemAttackMultiplier(weaponEnchantment, opponentType)
			* this.getItemAttackMultiplier(armorEnchantment, opponentType);
	}

	private getItemOtherStatMultiplier(itemEnchantment: ItemEnchantment | null, enchantmentKind: ItemEnchantmentKind, multipliers: [number, number, number]): number {
		let multiplier = 1;

		if (itemEnchantment?.kind === enchantmentKind) {
			multiplier *= multipliers[itemEnchantment.level - 1];
		}

		return multiplier;
	}

	private getDefenseMultiplier(weaponEnchantment: ItemEnchantment | null, armorEnchantment: ItemEnchantment | null): number {
		return this.getItemOtherStatMultiplier(weaponEnchantment, ItemEnchantmentKind.DEFENSE, EnchantmentConstants.DEFENSE_MULTIPLIER)
			* this.getItemOtherStatMultiplier(armorEnchantment, ItemEnchantmentKind.DEFENSE, EnchantmentConstants.DEFENSE_MULTIPLIER);
	}

	private getSpeedMultiplier(weaponEnchantment: ItemEnchantment | null, armorEnchantment: ItemEnchantment | null): number {
		return this.getItemOtherStatMultiplier(weaponEnchantment, ItemEnchantmentKind.SPEED, EnchantmentConstants.SPEED_MULTIPLIER)
			* this.getItemOtherStatMultiplier(armorEnchantment, ItemEnchantmentKind.SPEED, EnchantmentConstants.SPEED_MULTIPLIER);
	}

	private getBaseBreathBonus(weaponEnchantment: ItemEnchantment | null, armorEnchantment: ItemEnchantment | null): number {
		return (weaponEnchantment?.kind === ItemEnchantmentKind.BASE_BREATH ? EnchantmentConstants.BASE_BREATH_BONUS : 0)
			+ (armorEnchantment?.kind === ItemEnchantmentKind.BASE_BREATH ? EnchantmentConstants.BASE_BREATH_BONUS : 0);
	}

	private getMaxBreathBonus(weaponEnchantment: ItemEnchantment | null, armorEnchantment: ItemEnchantment | null): number {
		return (weaponEnchantment?.kind === ItemEnchantmentKind.MAX_BREATH ? EnchantmentConstants.MAX_BREATH_BONUS : 0)
			+ (armorEnchantment?.kind === ItemEnchantmentKind.MAX_BREATH ? EnchantmentConstants.MAX_BREATH_BONUS : 0);
	}

	private getAlterationBonusMultiplier(
		weaponEnchantment: ItemEnchantment | null,
		armorEnchantment: ItemEnchantment | null,
		alterationKind: ItemEnchantmentKind,
		alterationMultiplier: number
	): number {
		let multiplier = 1;

		if (weaponEnchantment?.kind === alterationKind) {
			multiplier *= alterationMultiplier;
		}
		if (armorEnchantment?.kind === alterationKind) {
			multiplier *= alterationMultiplier;
		}

		return multiplier;
	}

	/**
	 * The fighter loads its various stats
	 */
	public async loadStats(opponentType: OpponentType): Promise<void> {
		const playerActiveObjects: PlayerActiveObjects = await InventorySlots.getPlayerActiveObjects(this.player.id);
		const weaponEnchantment: ItemEnchantment | null = ItemEnchantment.getById(playerActiveObjects.weapon.itemEnchantmentId);
		const armorEnchantment: ItemEnchantment | null = ItemEnchantment.getById(playerActiveObjects.armor.itemEnchantmentId);

		this.stats.energy = this.player.getMaxCumulativeEnergy(playerActiveObjects);
		this.stats.maxEnergy = this.player.getMaxCumulativeEnergy(playerActiveObjects);
		this.stats.attack = this.player.getCumulativeAttack(playerActiveObjects) * this.getAttackMultiplier(weaponEnchantment, armorEnchantment, opponentType);
		this.stats.defense = this.player.getCumulativeDefense(playerActiveObjects) * this.getDefenseMultiplier(weaponEnchantment, armorEnchantment);
		this.stats.speed = this.player.getCumulativeSpeed(playerActiveObjects) * this.getSpeedMultiplier(weaponEnchantment, armorEnchantment);
		this.stats.breath = this.player.getBaseBreath() + this.getBaseBreathBonus(weaponEnchantment, armorEnchantment);
		this.stats.maxBreath = this.player.getMaxBreath() + this.getMaxBreathBonus(weaponEnchantment, armorEnchantment);
		this.stats.breathRegen = this.player.getBreathRegen();
		if (this.player.petId) {
			this.pet = await PetEntities.getById(this.player.petId);
		}

		// Load alterations enchantments
		this.getAlterationBonusMultiplier(weaponEnchantment, armorEnchantment, ItemEnchantmentKind.BURNED_DAMAGE, EnchantmentConstants.BURNED_DAMAGE_BONUS_MULTIPLIER);
		this.getAlterationBonusMultiplier(weaponEnchantment, armorEnchantment, ItemEnchantmentKind.POISONED_DAMAGE, EnchantmentConstants.POISONED_DAMAGE_BONUS_MULTIPLIER);
		this.getAlterationBonusMultiplier(weaponEnchantment, armorEnchantment, ItemEnchantmentKind.FROZEN_DAMAGE, EnchantmentConstants.FROZEN_DAMAGE_BONUS_MULTIPLIER);
	}
}
