import {
	Model, ModelStatic, Sequelize
} from "sequelize";

/**
 * Sequelize instance the model was initialized with. Sequelize types it as optional because a model can be used before
 * its initialization: that mistake throws an explicit error here, instead of being hidden behind a non-null assertion
 * @param model
 */
export function getModelSequelize(model: ModelStatic<Model>): Sequelize {
	if (!model.sequelize) {
		throw new Error(`The model ${model.name} is used before its initialization`);
	}
	return model.sequelize;
}
