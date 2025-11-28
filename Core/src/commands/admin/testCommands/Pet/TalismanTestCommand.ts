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

/**
 * Give or remove a talisman to/from the player
 */
const talismanTestCommand: ExecuteTestCommandLike = async (player, args) => {
	const talismanType = args[0]?.toLowerCase();
	const action = args[1]?.toLowerCase();

	// Validate talisman type
	if (talismanType !== TALISMAN_TYPES.ANCHOR && talismanType !== TALISMAN_TYPES.CLONE) {
		throw new Error(`Type de talisman invalide: "${talismanType}". Utilisez "anchor" ou "clone".`);
	}

	// Validate action
	if (action !== TALISMAN_ACTIONS.GIVE && action !== TALISMAN_ACTIONS.REMOVE) {
		throw new Error(`Action invalide: "${action}". Utilisez "give" ou "remove".`);
	}

	const isGiving = action === TALISMAN_ACTIONS.GIVE;

	if (talismanType === TALISMAN_TYPES.ANCHOR) {
		if (isGiving && player.hasTalisman) {
			return "Vous possédez déjà le Talisman d'Ancrage !";
		}
		if (!isGiving && !player.hasTalisman) {
			return "Vous ne possédez pas le Talisman d'Ancrage !";
		}
		player.hasTalisman = isGiving;
		await player.save();
		return isGiving
			? "✨ Vous avez reçu le **Talisman d'Ancrage** ! Vous pouvez maintenant envoyer votre familier en expédition."
			: "Le **Talisman d'Ancrage** a été retiré de votre inventaire.";
	}

	// Clone talisman
	if (isGiving && player.hasCloneTalisman) {
		return "Vous possédez déjà le Talisman de Clonage !";
	}
	if (!isGiving && !player.hasCloneTalisman) {
		return "Vous ne possédez pas le Talisman de Clonage !";
	}
	player.hasCloneTalisman = isGiving;
	await player.save();
	return isGiving
		? "✨ Vous avez reçu le **Talisman de Clonage** ! Votre familier peut maintenant vous assister en défense et dans les petits événements même en expédition."
		: "Le **Talisman de Clonage** a été retiré de votre inventaire.";
};

commandInfo.execute = talismanTestCommand;
