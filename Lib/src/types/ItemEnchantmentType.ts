import { CrowniclesIcons } from "../CrowniclesIcons";

export class ItemEnchantmentType {
	public static readonly DAMAGE = new ItemEnchantmentType("damage");

	public static readonly HEALTH = new ItemEnchantmentType("health");

	public static readonly DEFENSE = new ItemEnchantmentType("defense");

	public static readonly SPEED = new ItemEnchantmentType("speed");

	public static readonly MAGIC = new ItemEnchantmentType("magic");

	public static readonly OTHER = new ItemEnchantmentType("other");

	public get emoji(): string {
		return CrowniclesIcons.enchantmentTypes[this.id];
	}

	private constructor(id: keyof typeof CrowniclesIcons.enchantmentTypes) {
		this.id = id;
	}

	public readonly id: keyof typeof CrowniclesIcons.enchantmentTypes;
}
