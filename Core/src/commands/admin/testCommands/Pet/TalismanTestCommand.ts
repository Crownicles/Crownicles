import {
	ExecuteTestCommandLike, ITestCommand, TypeKey
} from "../../../../core/CommandsTest";

export const commandInfo: ITestCommand = {
	name: "talisman",
	commandFormat: "<type = anchor/clone> <action = give/remove>",
	typeWaited: {
		type: TypeKey.STRING,
		action: TypeKey.STRING
	},
	description: "Donne ou retire un talisman. Types: anchor (ancrage), clone (clonage). Actions: give (donner), remove (retirer)"
};

const TALISMAN_TYPES = {
	ANCHOR: "anchor",
	CLONE: "clone"
} as const;

const TALISMAN_ACTIONS = {
	GIVE: "give",
	REMOVE: "remove"
} as const;

type TalismanType = typeof TALISMAN_TYPES[keyof typeof TALISMAN_TYPES];
type TalismanAction = typeof TALISMAN_ACTIONS[keyof typeof TALISMAN_ACTIONS];

interface TalismanConfig {
	hasProperty: "hasTalisman" | "hasCloneTalisman";
	name: string;
	giveMessage: string;
	removeMessage: string;
	alreadyHasMessage: string;
	doesNotHaveMessage: string;
}

const TALISMAN_CONFIGS: Record<TalismanType, TalismanConfig> = {
	[TALISMAN_TYPES.ANCHOR]: {
		hasProperty: "hasTalisman",
		name: "Talisman d'Ancrage",
		giveMessage: "✨ Vous avez reçu le **Talisman d'Ancrage** ! Vous pouvez maintenant envoyer votre familier en expédition.",
		removeMessage: "Le **Talisman d'Ancrage** a été retiré de votre inventaire.",
		alreadyHasMessage: "Vous possédez déjà le Talisman d'Ancrage !",
		doesNotHaveMessage: "Vous ne possédez pas le Talisman d'Ancrage !"
	},
	[TALISMAN_TYPES.CLONE]: {
		hasProperty: "hasCloneTalisman",
		name: "Talisman de Clonage",
		giveMessage: "✨ Vous avez reçu le **Talisman de Clonage** ! Votre familier peut maintenant vous assister en défense et dans les petits événements même en expédition.",
		removeMessage: "Le **Talisman de Clonage** a été retiré de votre inventaire.",
		alreadyHasMessage: "Vous possédez déjà le Talisman de Clonage !",
		doesNotHaveMessage: "Vous ne possédez pas le Talisman de Clonage !"
	}
};

interface ValidatedTalismanArgs {
	talismanType: TalismanType;
	action: TalismanAction;
}

const VALID_TALISMAN_TYPES = new Set<string>([TALISMAN_TYPES.ANCHOR, TALISMAN_TYPES.CLONE]);
const VALID_TALISMAN_ACTIONS = new Set<string>([TALISMAN_ACTIONS.GIVE, TALISMAN_ACTIONS.REMOVE]);

/**
 * Validate command arguments and return parsed values
 */
function validateTalismanArgs(args: string[]): ValidatedTalismanArgs {
	const talismanType = args[0]?.toLowerCase();
	const action = args[1]?.toLowerCase();

	if (!VALID_TALISMAN_TYPES.has(talismanType)) {
		throw new Error(`Type de talisman invalide: "${talismanType}". Utilisez "anchor" ou "clone".`);
	}

	if (!VALID_TALISMAN_ACTIONS.has(action)) {
		throw new Error(`Action invalide: "${action}". Utilisez "give" ou "remove".`);
	}

	return {
		talismanType: talismanType as TalismanType,
		action: action as TalismanAction
	};
}

/**
 * Give or remove a talisman to/from the player
 */
const talismanTestCommand: ExecuteTestCommandLike = async (player, args) => {
	const {
		talismanType,
		action
	} = validateTalismanArgs(args);
	const isGiving = action === TALISMAN_ACTIONS.GIVE;
	const config = TALISMAN_CONFIGS[talismanType];
	const hasTalisman = player[config.hasProperty];

	if (isGiving && hasTalisman) {
		return config.alreadyHasMessage;
	}
	if (!isGiving && !hasTalisman) {
		return config.doesNotHaveMessage;
	}

	player[config.hasProperty] = isGiving;
	await player.save();

	return isGiving ? config.giveMessage : config.removeMessage;
};

commandInfo.execute = talismanTestCommand;
