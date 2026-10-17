import {
	ExecuteTestCommandLike, ITestCommand, TypeKey
} from "../../../../core/CommandsTest";
import { PlayerTalismansManager } from "../../../../core/database/game/models/PlayerTalismans";
import Player from "../../../../core/database/game/models/Player";

export const commandInfo: ITestCommand = {
	name: "talisman",
	commandFormat: "<type = anchor/clone/harvest> <action = give/remove>",
	typeWaited: {
		type: TypeKey.STRING,
		action: TypeKey.STRING
	},
	description: "Donne ou retire un talisman. Types: anchor (ancrage), clone (clonage), harvest (cœur sylvestre). Actions: give (donner), remove (retirer)"
};

const TALISMAN_TYPES = {
	ANCHOR: "anchor",
	CLONE: "clone",
	HARVEST: "harvest"
} as const;

const TALISMAN_ACTIONS = {
	GIVE: "give",
	REMOVE: "remove"
} as const;

type TalismanType = typeof TALISMAN_TYPES[keyof typeof TALISMAN_TYPES];
type TalismanAction = typeof TALISMAN_ACTIONS[keyof typeof TALISMAN_ACTIONS];
type TalismanProperty = "hasTalisman" | "hasCloneTalisman" | "hasRemoteHarvestTalisman";

interface TalismanConfig {
	hasProperty: TalismanProperty;
	giveMessage: string;
	removeMessage: string;
	alreadyHasMessage: string;
	doesNotHaveMessage: string;
}

const TALISMAN_CONFIGS: Record<TalismanType, TalismanConfig> = {
	[TALISMAN_TYPES.ANCHOR]: {
		hasProperty: "hasTalisman",
		giveMessage: "Vous avez reçu le **Talisman d'Ancrage** ! Vous pouvez maintenant envoyer votre familier en expédition.",
		removeMessage: "Le **Talisman d'Ancrage** a été retiré de votre inventaire.",
		alreadyHasMessage: "Vous possédez déjà le Talisman d'Ancrage !",
		doesNotHaveMessage: "Vous ne possédez pas le Talisman d'Ancrage !"
	},
	[TALISMAN_TYPES.CLONE]: {
		hasProperty: "hasCloneTalisman",
		giveMessage: "Vous avez reçu le **Talisman de Clonage** ! Votre familier peut maintenant vous assister en défense et dans les petits événements même en expédition.",
		removeMessage: "Le **Talisman de Clonage** a été retiré de votre inventaire.",
		alreadyHasMessage: "Vous possédez déjà le Talisman de Clonage !",
		doesNotHaveMessage: "Vous ne possédez pas le Talisman de Clonage !"
	},
	[TALISMAN_TYPES.HARVEST]: {
		hasProperty: "hasRemoteHarvestTalisman",
		giveMessage: "Vous avez reçu le **Cœur Sylvestre** ! Vous pouvez maintenant récolter votre jardin à distance via /jardin.",
		removeMessage: "Le **Cœur Sylvestre** a été retiré de votre inventaire.",
		alreadyHasMessage: "Vous possédez déjà le Cœur Sylvestre !",
		doesNotHaveMessage: "Vous ne possédez pas le Cœur Sylvestre !"
	}
};

interface ValidatedTalismanArgs {
	talismanType: TalismanType;
	action: TalismanAction;
}

const VALID_TALISMAN_TYPES = new Set<string>(Object.values(TALISMAN_TYPES));
const VALID_TALISMAN_ACTIONS = new Set<string>(Object.values(TALISMAN_ACTIONS));

function isTalismanType(value: string | undefined): value is TalismanType {
	return value !== undefined && VALID_TALISMAN_TYPES.has(value);
}

function isTalismanAction(value: string | undefined): value is TalismanAction {
	return value !== undefined && VALID_TALISMAN_ACTIONS.has(value);
}

/**
 * Validate command arguments and return parsed values
 */
function validateTalismanArgs(args: string[]): ValidatedTalismanArgs {
	const talismanType = args[0]?.toLowerCase();
	const action = args[1]?.toLowerCase();

	if (!isTalismanType(talismanType)) {
		throw new Error(`Type de talisman invalide: "${talismanType}". Utilisez "anchor", "clone" ou "harvest".`);
	}

	if (!isTalismanAction(action)) {
		throw new Error(`Action invalide: "${action}". Utilisez "give" ou "remove".`);
	}

	return {
		talismanType,
		action
	};
}

async function updateTalisman(player: Player, config: TalismanConfig, action: TalismanAction): Promise<string> {
	const isGiving = action === TALISMAN_ACTIONS.GIVE;
	const talismans = await PlayerTalismansManager.getOfPlayer(player.id);
	const hasTalisman = talismans[config.hasProperty];
	if (hasTalisman === isGiving) {
		return isGiving ? config.alreadyHasMessage : config.doesNotHaveMessage;
	}

	talismans[config.hasProperty] = isGiving;
	await talismans.save();
	return isGiving ? config.giveMessage : config.removeMessage;
}

/**
 * Give or remove a talisman to/from the player
 */
const talismanTestCommand: ExecuteTestCommandLike = (player, args) => {
	const {
		talismanType,
		action
	} = validateTalismanArgs(args);
	return updateTalisman(player, TALISMAN_CONFIGS[talismanType], action);
};

commandInfo.execute = talismanTestCommand;
