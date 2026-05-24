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
			{ quantity: Sequelize.literal(`quantity - ${Number(quantity)}`) },
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
		 * Snapshot pre-check then decrement. Two callers ask for the same
		 * materialId twice in the same call (rare but possible via crafting
		 * recipes), so duplicates are summed before the check. The pre-check
		 * runs under the ambient CLS transaction created by the enclosing
		 * `withLockedEntities` / `Player.withLocked` block, so no concurrent
		 * writer can shrink the rows between the snapshot and the decrements.
		 * Returning `false` before any decrement guarantees zero side effects
		 * on insufficient stock — no in-band refund, no risk of double rollback
		 * if the caller is itself transactional.
		 */
		const required = new Map<number, number>();
		for (const m of materials) {
			if (m.quantity <= 0) {
				continue;
			}
			required.set(m.materialId, (required.get(m.materialId) ?? 0) + m.quantity);
		}
		if (required.size === 0) {
			return true;
		}

		const owned = new Map<number, number>();
		const rows = await Material.findAll({
			where: {
				playerId,
				materialId: { [Op.in]: [...required.keys()] }
			}
		});
		for (const row of rows) {
			owned.set(row.materialId, row.quantity);
		}
		for (const [materialId, qty] of required) {
			if ((owned.get(materialId) ?? 0) < qty) {
				return false;
			}
		}

		for (const [materialId, qty] of required) {
			const ok = await Materials.consumeMaterial(playerId, materialId, qty);
			if (!ok) {
				/*
				 * Pre-check passed but decrement failed: only possible if the caller does not
				 * hold the player row lock and a concurrent writer drained the row in between.
				 * Throwing aborts the enclosing transaction, which is the single authoritative
				 * rollback path.
				 */
				throw new Error(
					`consumeMaterials: post-pre-check decrement failed for playerId=${playerId} materialId=${materialId} qty=${qty}. Caller must hold the player row lock.`
				);
			}
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
