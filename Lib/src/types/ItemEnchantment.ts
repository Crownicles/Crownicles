import { ItemEnchantmentType } from "./ItemEnchantmentType";

export class ItemEnchantmentKind {
	public static readonly PVP_ATTACK = new ItemEnchantmentKind("pvpAttack", ItemEnchantmentType.DAMAGE);

	public static readonly PVE_ATTACK = new ItemEnchantmentKind("pveAttack", ItemEnchantmentType.DAMAGE);

	public static readonly ALL_ATTACK = new ItemEnchantmentKind("allAttack", ItemEnchantmentType.DAMAGE);

	public static readonly DEFENSE = new ItemEnchantmentKind("defense", ItemEnchantmentType.DEFENSE);

	public static readonly SPEED = new ItemEnchantmentKind("speed", ItemEnchantmentType.SPEED);

	public static readonly MAX_ENERGY = new ItemEnchantmentKind("maxEnergy", ItemEnchantmentType.HEALTH);

	public static readonly MAX_HEALTH = new ItemEnchantmentKind("maxHealth", ItemEnchantmentType.HEALTH);

	public static readonly BASE_BREATH = new ItemEnchantmentKind("baseBreath", ItemEnchantmentType.OTHER);

	public static readonly MAX_BREATH = new ItemEnchantmentKind("maxBreath", ItemEnchantmentType.OTHER);

	public static readonly BURNED_DAMAGE = new ItemEnchantmentKind("burnedDamage", ItemEnchantmentType.MAGIC);

	public static readonly FROZEN_DAMAGE = new ItemEnchantmentKind("frozenDamage", ItemEnchantmentType.MAGIC);

	public static readonly POISONED_DAMAGE = new ItemEnchantmentKind("poisonedDamage", ItemEnchantmentType.MAGIC);


	private constructor(id: string, type: ItemEnchantmentType) {
		this.id = id;
		this.type = type;
	}

	public readonly id: string;

	public readonly type: ItemEnchantmentType;
}

export class ItemEnchantment {
	public static readonly PVP_ATTACK_1 = new ItemEnchantment("pvpAttack1", ItemEnchantmentKind.PVP_ATTACK, 1);

	public static readonly PVP_ATTACK_2 = new ItemEnchantment("pvpAttack2", ItemEnchantmentKind.PVP_ATTACK, 2);

	public static readonly PVP_ATTACK_3 = new ItemEnchantment("pvpAttack3", ItemEnchantmentKind.PVP_ATTACK, 3);

	public static readonly PVE_ATTACK_1 = new ItemEnchantment("pveAttack1", ItemEnchantmentKind.PVE_ATTACK, 1);

	public static readonly PVE_ATTACK_2 = new ItemEnchantment("pveAttack2", ItemEnchantmentKind.PVE_ATTACK, 2);

	public static readonly PVE_ATTACK_3 = new ItemEnchantment("pveAttack3", ItemEnchantmentKind.PVE_ATTACK, 3);

	public static readonly ALL_ATTACK_1 = new ItemEnchantment("allAttack1", ItemEnchantmentKind.ALL_ATTACK, 1);

	public static readonly ALL_ATTACK_2 = new ItemEnchantment("allAttack2", ItemEnchantmentKind.ALL_ATTACK, 2);

	public static readonly ALL_ATTACK_3 = new ItemEnchantment("allAttack3", ItemEnchantmentKind.ALL_ATTACK, 3);

	public static readonly DEFENSE_1 = new ItemEnchantment("defense1", ItemEnchantmentKind.DEFENSE, 1);

	public static readonly DEFENSE_2 = new ItemEnchantment("defense2", ItemEnchantmentKind.DEFENSE, 2);

	public static readonly DEFENSE_3 = new ItemEnchantment("defense3", ItemEnchantmentKind.DEFENSE, 3);

	public static readonly SPEED_1 = new ItemEnchantment("speed1", ItemEnchantmentKind.SPEED, 1);

	public static readonly SPEED_2 = new ItemEnchantment("speed2", ItemEnchantmentKind.SPEED, 2);

	public static readonly SPEED_3 = new ItemEnchantment("speed3", ItemEnchantmentKind.SPEED, 3);

	public static readonly MAX_ENERGY_1 = new ItemEnchantment("maxEnergy1", ItemEnchantmentKind.MAX_ENERGY, 1);

	public static readonly MAX_ENERGY_2 = new ItemEnchantment("maxEnergy2", ItemEnchantmentKind.MAX_ENERGY, 2);

	public static readonly MAX_ENERGY_3 = new ItemEnchantment("maxEnergy3", ItemEnchantmentKind.MAX_ENERGY, 3);

	public static readonly MAX_HEALTH_1 = new ItemEnchantment("maxHealth1", ItemEnchantmentKind.MAX_HEALTH, 1);

	public static readonly MAX_HEALTH_2 = new ItemEnchantment("maxHealth2", ItemEnchantmentKind.MAX_HEALTH, 2);

	public static readonly MAX_HEALTH_3 = new ItemEnchantment("maxHealth3", ItemEnchantmentKind.MAX_HEALTH, 3);

	public static readonly BASE_BREATH_1 = new ItemEnchantment("baseBreath1", ItemEnchantmentKind.BASE_BREATH, 1);

	public static readonly MAX_BREATH_1 = new ItemEnchantment("maxBreath1", ItemEnchantmentKind.MAX_BREATH, 1);

	public static readonly BURNED_DAMAGE_1 = new ItemEnchantment("burnedDamage1", ItemEnchantmentKind.BURNED_DAMAGE, 1);

	public static readonly FROZEN_DAMAGE_1 = new ItemEnchantment("frozenDamage1", ItemEnchantmentKind.FROZEN_DAMAGE, 1);

	public static readonly POISONED_DAMAGE_1 = new ItemEnchantment("poisonedDamage1", ItemEnchantmentKind.POISONED_DAMAGE, 1);


	private static readonly enchantmentsById: Map<string, ItemEnchantment> = new Map(Object.values(ItemEnchantment).map(e => [e.id, e]));

	public readonly id: string;

	public readonly kind: ItemEnchantmentKind;

	public readonly level: number;

	constructor(id: string, kind: ItemEnchantmentKind, level: number) {
		this.id = id;
		this.kind = kind;
		this.level = level;
	}

	public static getById(id: string): ItemEnchantment | null {
		return this.enchantmentsById.get(id) ?? null;
	}

	public static getAllEnchantments(): ItemEnchantment[] {
		return Array.from(this.enchantmentsById.values());
	}
}
