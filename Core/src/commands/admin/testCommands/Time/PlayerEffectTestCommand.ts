import { NumberChangeReason } from "../../../../../../Lib/src/constants/LogsConstants";
import {
	ExecuteTestCommandLike, ITestCommand, TypeKey
} from "../../../../core/CommandsTest";
import { TravelTime } from "../../../../core/maps/TravelTime";
import { Effect } from "../../../../../../Lib/src/types/Effect";

const effects = Array.from(Effect.getAll()).filter(value => [
	Effect.NOT_STARTED,
	Effect.NO_EFFECT,
	Effect.DEAD,
	Effect.OCCUPIED
].indexOf(value) === -1);
let printableEffects = "";
effects.forEach(e => {
	printableEffects = printableEffects.concat(`- ${e.id}\n`);
});

export const commandInfo: ITestCommand = {
	name: "playereffect",
	aliases: ["effect"],
	commandFormat: "<effect>",
	typeWaited: { effect: TypeKey.STRING },
	description: `Applique l'effet spécifié au joueur testeur. Permet de tester les différents états de jeu et leurs conséquences\nListe des effets :\n${printableEffects}`
};

/**
 * Set the effect of the player
 */
const playerEffectTestCommand: ExecuteTestCommandLike = async (player, args) => {
	const effect = Effect.getById(args[0]);
	if (!effect) {
		throw new Error("Effet inconnu !");
	}
	if ([
		Effect.NOT_STARTED,
		Effect.NO_EFFECT,
		Effect.DEAD,
		Effect.OCCUPIED
	].includes(effect)) {
		throw new Error("Cet effet ne peut pas être appliqué !");
	}
	if (player.effectId === Effect.NOT_STARTED.id) {
		// Prevent the non initialized player to mess with the game's travel logic
		throw new Error("Vous n'avez pas encore démarré l'aventure, laisse toi le temps de commencer (`/test command:init`) !");
	}
	await TravelTime.applyEffect(player, effect, 0, new Date(), NumberChangeReason.TEST);
	await player.save();
	return `Vous avez maintenant l'effet ${effect.id} !`;
};

commandInfo.execute = playerEffectTestCommand;
