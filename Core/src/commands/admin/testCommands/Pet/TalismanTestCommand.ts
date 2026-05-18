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

const TALISMAN_STORAGE = {
	PET_TALISMANS: "petTalismans",
	PLAYER: "player"
} as const;

type TalismanType = typeof TALISMAN_TYPES[keyof typeof TALISMAN_TYPES];
type TalismanAction = typeof TALISMAN_ACTIONS[keyof typeof TALISMAN_ACTIONS];
type PetTalismanProperty = "hasTalisman" | "hasCloneTalisman";
type PlayerTalismanProperty = "hasRemoteHarvestTalisman";

interface BaseTalismanConfig {
	giveMessage: string;
	removeMessage: string;
	alreadyHasMessage: string;
	doesNotHaveMessage: string;
}

interface PetTalismanConfig extends BaseTalismanConfig {
	storage: typeof TALISMAN_STORAGE.PET_TALISMANS;
	hasProperty: PetTalismanProperty;
}

interface PlayerTalismanConfig extends BaseTalismanConfig {
	storage: typeof TALISMAN_STORAGE.PLAYER;
	hasProperty: PlayerTalismanProperty;
}

type TalismanConfig = PetTalismanConfig | PlayerTalismanConfig;

const TALISMAN_CONFIGS: Record<TalismanType, TalismanConfig> = {
	[TALISMAN_TYPES.ANCHOR]: {
		storage: TALISMAN_STORAGE.PET_TALISMANS,
		hasProperty: "hasTalisman",
		giveMessage: "Vous avez reçu le **Talisman d'Ancrage** ! Vous pouvez maintenant envoyer votre familier en expédition.",
		removeMessage: "Le **Talisman d'Ancrage** a été retiré de votre inventaire.",
		alreadyHasMessage: "Vous possédez déjà le Talisman d'Ancrage !",
		doesNotHaveMessage: "Vous ne possédez pas le Talisman d'Ancrage !"
	},
	[TALISMAN_TYPES.CLONE]: {
		storage: TALISMAN_STORAGE.PET_TALISMANS,
		hasProperty: "hasCloneTalisman",
		giveMessage: "Vous avez reçu le **Talisman de Clonage** ! Votre familier peut maintenant vous assister en défense et dans les petits événements même en expédition.",
		removeMessage: "Le **Talisman de Clonage** a été retiré de votre inventaire.",
		alreadyHasMessage: "Vous possédez déjà le Talisman de Clonage !",
		doesNotHaveMessage: "Vous ne possédez pas le Talisman de Clonage !"
	},
	[TALISMAN_TYPES.HARVEST]: {
		storage: TALISMAN_STORAGE.PLAYER,
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

function isPlayerTalismanConfig(config: TalismanConfig): config is PlayerTalismanConfig {
	return config.storage === TALISMAN_STORAGE.PLAYER;
}

function getTalismanConflictMessage(config: TalismanConfig, isGiving: boolean, hasTalisman: boolean): string | null {
	if (hasTalisman !== isGiving) {
		return null;
	}
	return isGiving ? config.alreadyHasMessage : config.doesNotHaveMessage;
}

function getTalismanSuccessMessage(config: TalismanConfig, isGiving: boolean): string {
	return isGiving ? config.giveMessage : config.removeMessage;
}

async function updatePlayerTalismanUnderLock(
	lockedPlayer: Player,
	config: PlayerTalismanConfig,
	isGiving: boolean
): Promise<string | null> {
	const hasTalisman = lockedPlayer[config.hasProperty];
	const conflictMessage = getTalismanConflictMessage(config, isGiving, hasTalisman);
	if (conflictMessage) {
		return conflictMessage;
	}

	lockedPlayer[config.hasProperty] = isGiving;
	await lockedPlayer.save();
	return null;
}

async function updatePlayerTalisman(player: Player, config: PlayerTalismanConfig, isGiving: boolean): Promise<string> {
	const conflictMessage = await Player.withLocked(
		player.id,
		lockedPlayer => updatePlayerTalismanUnderLock(lockedPlayer, config, isGiving)
	);

	return conflictMessage ?? getTalismanSuccessMessage(config, isGiving);
}

async function updatePetTalisman(player: Player, config: PetTalismanConfig, isGiving: boolean): Promise<string> {
	const talismans = await PlayerTalismansManager.getOfPlayer(player.id);
	const hasTalisman = talismans[config.hasProperty];
	const conflictMessage = getTalismanConflictMessage(config, isGiving, hasTalisman);
	if (conflictMessage) {
		return conflictMessage;
	}

	talismans[config.hasProperty] = isGiving;
	await talismans.save();
	return getTalismanSuccessMessage(config, isGiving);
}

function updateTalisman(player: Player, config: TalismanConfig, action: TalismanAction): Promise<string> {
	const isGiving = action === TALISMAN_ACTIONS.GIVE;
	if (isPlayerTalismanConfig(config)) {
		return updatePlayerTalisman(player, config, isGiving);
	}
	return updatePetTalisman(player, config, isGiving);
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
