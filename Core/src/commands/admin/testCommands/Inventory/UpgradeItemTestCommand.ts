import {
	ExecuteTestCommandLike, ITestCommand, TypeKey
} from "../../../../core/CommandsTest";
import {
	InventorySlot, InventorySlots
} from "../../../../core/database/game/models/InventorySlot";

export const commandInfo: ITestCommand = {
	name: "upgradeitem",
	aliases: ["upgrade", "ui"],
	commandFormat: "<weapon/armor> <level [0-5]>",
	typeWaited: {
		"weapon/armor": TypeKey.STRING,
		"level [0-5]": TypeKey.INTEGER
	},
	description: "Permet d'améliorer l'objet équipé dans la catégorie donnée. Niveaux disponibles : 0 à 5 (0 = pas d'amélioration, 5 = amélioration maximale)"
};

const upgradeItemTestCommand: ExecuteTestCommandLike = async (player, args) => {
	let itemSlot: InventorySlot;

	if (args[0] === "weapon") {
		itemSlot = (await InventorySlots.getMainWeaponSlot(player.id))!;
	}
	else if (args[0] === "armor") {
		itemSlot = (await InventorySlots.getMainArmorSlot(player.id))!;
	}
	else {
		throw Error("Catégorie inconnue. Elle doit être 'weapon' ou 'armor'");
	}

	if (itemSlot.itemId === 0) {
		throw Error("Vous n'avez pas d'objet équipé dans cette catégorie.");
	}

	const level = parseInt(args[1], 10);
	if (isNaN(level) || level < 0 || level > 5) {
		throw Error("Niveau invalide. Il doit être un nombre entre 0 et 5.");
	}

	itemSlot.itemLevel = level;
	await itemSlot.save();
	return `Vous avez définit l'amélioration de votre objet équipé dans la catégorie "${args[0]}" au niveau "${level}".`;
};

commandInfo.execute = upgradeItemTestCommand;
