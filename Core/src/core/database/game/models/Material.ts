import {
	DataTypes, Model, Op, Sequelize
} from "sequelize";
import * as moment from "moment";

export class Material extends Model {
	declare readonly playerId: number;

	declare readonly materialId: number;

	declare quantity: number;

	declare updatedAt: Date;

	declare createdAt: Date;
}

export class Materials {
	public static async giveMaterial(
		playerId: number,
		materialId: number,
		quantity: number
	): Promise<void> {
		const material = await Material.findOne({
			where: {
				playerId,
				materialId
			}
		});

		if (material) {
			material.quantity += quantity;
			await material.save();
		}
		else {
			await Material.create({
				playerId,
				materialId,
				quantity
			});
		}
	}

	public static getPlayerMaterials(playerId: number): Promise<Material[]> {
		return Material.findAll({ where: { playerId } });
	}

	public static async consumeMaterial(
		playerId: number,
		materialId: number,
		quantity: number
	): Promise<boolean> {
		if (quantity <= 0) {
			return true;
		}

		/*
		 * Race-free atomic decrement: a single UPDATE with `quantity >= n` in
		 * the WHERE clause performs the check-and-set in one MariaDB
		 * statement. Two concurrent transactions racing to consume the same
		 * material can never both succeed — one will match 1 row, the other 0.
		 * Picks up an ambient CLS transaction automatically when called inside
		 * a `withLockedEntities` / `Player.withLocked` block.
		 */
		const [affectedCount] = await Material.update(
			{ quantity: Sequelize.literal(`quantity - ${Number(quantity)}`) as unknown as number },
			{
				where: {
					playerId,
					materialId,
					quantity: { [Op.gte]: quantity }
				}
			}
		);
		return affectedCount === 1;
	}

	public static async consumeMaterials(
		playerId: number,
		materials: {
			materialId: number;
			quantity: number;
		}[]
	): Promise<boolean> {
		/*
		 * Two-phase consume: try to decrement every material atomically; if any
		 * decrement fails, refund the ones already taken. The refund is
		 * best-effort and safe because `giveMaterial` is an upsert. When called
		 * inside an enclosing `withLockedEntities` block (the standard cooking
		 * /blacksmith pattern via `lockedPlayer.id`), the whole sequence is
		 * one transaction and the refund branch turns into a no-op rollback.
		 */
		const consumed: {
			materialId: number; quantity: number;
		}[] = [];
		for (const material of materials) {
			const ok = await Materials.consumeMaterial(playerId, material.materialId, material.quantity);
			if (!ok) {
				for (const taken of consumed) {
					await Materials.giveMaterial(playerId, taken.materialId, taken.quantity);
				}
				return false;
			}
			consumed.push(material);
		}
		return true;
	}
}

export function initModel(sequelize: Sequelize): void {
	Material.init({
		playerId: {
			type: DataTypes.INTEGER,
			primaryKey: true
		},
		materialId: {
			type: DataTypes.TINYINT,
			primaryKey: true
		},
		quantity: {
			type: DataTypes.INTEGER,
			defaultValue: 0
		},
		updatedAt: {
			type: DataTypes.DATE,
			defaultValue: moment()
				.format("YYYY-MM-DD HH:mm:ss")
		},
		createdAt: {
			type: DataTypes.DATE,
			defaultValue: moment()
				.format("YYYY-MM-DD HH:mm:ss")
		}
	}, {
		sequelize,
		tableName: "material",
		freezeTableName: true
	})
		.beforeSave(instance => {
			instance.updatedAt = moment()
				.toDate();
		});
}

export default Material;
