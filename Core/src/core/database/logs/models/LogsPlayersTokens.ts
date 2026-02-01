import {
	LogsPlayersNumbers, logsPlayersNumbersAttributes
} from "./LogsPlayersNumbers";
import { Sequelize } from "sequelize";

export class LogsPlayersTokens extends LogsPlayersNumbers {
}

export function initModel(sequelize: Sequelize): void {
	LogsPlayersTokens.init(logsPlayersNumbersAttributes, {
		sequelize,
		tableName: "players_tokens",
		freezeTableName: true,
		timestamps: false
	});

	LogsPlayersTokens.removeAttribute("id");
}
