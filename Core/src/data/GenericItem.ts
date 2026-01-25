import { Data } from "./Data";

export abstract class GenericItem extends Data<number> {
	declare readonly rarity: number;


	abstract categoryName: string;

	public slot!: number;


	public abstract getAttack(): number;

	public abstract getDefense(): number;

	public abstract getSpeed(): number;

	public abstract getCategory(): number;

	public abstract getItemAddedValue(): number;
}
