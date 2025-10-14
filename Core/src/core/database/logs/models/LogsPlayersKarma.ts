import {
	LogsPlayersNumbers, logsPlayersNumbersAttributes
} from "./LogsPlayersNumbers";
import { Sequelize } from "sequelize";

export class LogsPlayersKarma extends LogsPlayersNumbers {
}

export function initModel(sequelize: Sequelize): void {
	LogsPlayersKarma.init(logsPlayersNumbersAttributes, {
		sequelize,
		tableName: "players_karma",
		freezeTableName: true,
		timestamps: false
	});

	LogsPlayersKarma.removeAttribute("id");
}
