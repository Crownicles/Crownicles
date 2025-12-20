import {
	DataTypes, Model, Sequelize
} from "sequelize";
import * as moment from "moment/moment";

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
		materialId: string,
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
