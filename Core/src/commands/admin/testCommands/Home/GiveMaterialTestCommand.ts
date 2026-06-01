import {
	ExecuteTestCommandLike, ITestCommand, TypeKey
} from "../../../../core/CommandsTest";
import { Materials } from "../../../../core/database/game/models/Material";

export const commandInfo: ITestCommand = {
	name: "givematerial",
	commandFormat: "<materialId> <quantity>",
	typeWaited: {
		materialId: TypeKey.INTEGER,
		quantity: TypeKey.INTEGER
	},
	description: "Donne un matériau au joueur. Ex: bois commun=51,58,64 | bois peu commun=2,9,88 | bois rare=18,31,84"
};

const giveMaterialTestCommand: ExecuteTestCommandLike = async (player, args) => {
	const materialId = parseInt(args[0], 10);
	const quantity = parseInt(args[1], 10);

	await Materials.giveMaterial(player.id, materialId, quantity);

	return `Vous avez reçu ${quantity}x matériau #${materialId} !`;
};

commandInfo.execute = giveMaterialTestCommand;
