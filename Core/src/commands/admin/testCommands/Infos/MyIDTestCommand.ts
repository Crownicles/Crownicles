import {
	ExecuteTestCommandLike, ITestCommand
} from "../../../../core/CommandsTest";

export const commandInfo: ITestCommand = {
	name: "myids",
	description: "Affiche vos identifiants de joueur (ID interne et Keycloak). Utile pour les commandes nécessitant un ID joueur comme resetbo3"
};

/**
 * Show your player's ID
 */
const myIDTestCommand: ExecuteTestCommandLike = player => `Player id: ${player.id}\nKeycloak id: ${player.keycloakId}`;

commandInfo.execute = myIDTestCommand;
