import {
	ExecuteTestCommandLike, ITestCommand, TypeKey
} from "../../../../core/CommandsTest";
import { BlessingManager } from "../../../../core/blessings/BlessingManager";
import {
	BlessingConstants, BlessingType
} from "../../../../../../Lib/src/constants/BlessingConstants";
import { RandomUtils } from "../../../../../../Lib/src/utils/RandomUtils";

export const commandInfo: ITestCommand = {
	name: "triggerblessing",
	aliases: ["tb"],
	commandFormat: "[type]",
	typeWaited: { type: TypeKey.INTEGER },
	minArgs: 0,
	description: "Force le déclenchement d'une bénédiction. Type 1-9, ou aléatoire si non spécifié"
};

const triggerBlessingTestCommand: ExecuteTestCommandLike = async (player, args, response) => {
	const blessingManager = BlessingManager.getInstance();
	let type: BlessingType;

	if (args.length > 0) {
		type = parseInt(args[0], 10) as BlessingType;
		if (type < 1 || type > BlessingConstants.TOTAL_BLESSING_TYPES) {
			throw new Error(`Type invalide : doit être entre 1 et ${BlessingConstants.TOTAL_BLESSING_TYPES}`);
		}
	}
	else {
		type = RandomUtils.randInt(1, BlessingConstants.TOTAL_BLESSING_TYPES + 1) as BlessingType;
	}

	await blessingManager.forceActivateBlessing(type, player.keycloakId, response);

	return `Bénédiction de type ${type} (${BlessingType[type]}) activée avec succès !`;
};

commandInfo.execute = triggerBlessingTestCommand;
