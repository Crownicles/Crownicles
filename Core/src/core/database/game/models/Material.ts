import {
	DataTypes, Model, Sequelize
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
		const material = await Material.findOne({
			where: {
				playerId,
				materialId
			}
		});

		if (!material || material.quantity < quantity) {
			return false;
		}

		material.quantity -= quantity;
		await material.save();
		return true;
	}

	public static async consumeMaterials(
		playerId: number,
		materials: {
			materialId: number;
			quantity: number;
		}[]
	): Promise<boolean> {
		// First check if all materials are available
		const playerMaterials = await Materials.getPlayerMaterials(playerId);
		const playerMaterialMap = new Map(playerMaterials.map(m => [m.materialId, m.quantity]));

		for (const material of materials) {
			const playerQuantity = playerMaterialMap.get(material.materialId) ?? 0;
			if (playerQuantity < material.quantity) {
				return false;
			}
		}

		// Then consume all materials
		for (const material of materials) {
			await Materials.consumeMaterial(playerId, material.materialId, material.quantity);
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
