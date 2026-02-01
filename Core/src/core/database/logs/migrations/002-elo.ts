import {
	DataTypes, QueryInterface
} from "sequelize";
import {
	logsFightsActionsAttributes001,
	logsFightsResultsAttributes001, logsPlayersAttributes001, logsPlayersClassChangesAttributes001
} from "./001-initial-database";
import Player from "../../game/models/Player";

const logsFightsActionsAttributes002 = {
	id: {
		type: DataTypes.SMALLINT.UNSIGNED,
		primaryKey: true,
		autoIncrement: true
	},
	name: {
		type: DataTypes.STRING,
		allowNull: false
	},
	classId: {
		type: DataTypes.TINYINT.UNSIGNED,
		allowNull: true
	}
};

const logsFightsActionsUsedAttributes002 = {
	fightId: {
		type: DataTypes.INTEGER,
		allowNull: false
	},
	player: {
		type: DataTypes.TINYINT,
		allowNull: false
	},
	actionId: {
		type: DataTypes.SMALLINT.UNSIGNED,
		allowNull: false
	},
	count: {
		type: DataTypes.TINYINT,
		allowNull: false
	}
};

/**
 * Build a map for a playerId to its classes history
 */
async function buildPlayersClassesHistory(context: QueryInterface): Promise<{ [playerId: number]: {
	classId: number; date: number;
}[]; }> {
	// Build a map to convert a discordId to a log player id
	const discordIdToPlayerId: { [discordId: string]: number } = {};

	const logPlayersModel = context.sequelize.define("players", logsPlayersAttributes001, { timestamps: false });
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const logPlayers: any[] = await logPlayersModel.findAll();
	for (const logPlayer of logPlayers) {
		discordIdToPlayerId[logPlayer.discordId] = logPlayer.id;
	}

	// The final map to be returned
	const dict: { [playerId: number]: {
		classId: number; date: number;
	}[]; } = {};

	// Fill the final map with player current classes
	const players = await Player.findAll();
	for (const player of players) {
		const playerId = discordIdToPlayerId[(player as unknown as { discordUserId: string }).discordUserId];
		if (playerId) {
			if (!dict[playerId]) {
				dict[playerId] = [];
			}
			dict[playerId].push({
				classId: player.class, date: 0
			});
		}
	}

	// Fill the final map with classes changes
	const logClassesChangesModel = context.sequelize.define("players_class_changes", logsPlayersClassChangesAttributes001, { timestamps: false });
	logClassesChangesModel.removeAttribute("id");
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const classChanges: any[] = await logClassesChangesModel.findAll();
	for (const classChange of classChanges) {
		const history = dict[classChange.playerId];
		if (history) {
			dict[classChange.playerId].push({
				classId: classChange.classId, date: classChange.date
			});
		}
	}

	return dict;
}

/**
 * Get (and register if missing) a fight action from a name and a classId
 * @param fightActionsDict
 * @param fightActions
 * @param actionName
 * @param classId
 */
function getOrRegisterFightAction(
	fightActionsDict: { [key: string]: number },
	fightActions: {
		id: number; name: string; classId: number;
	}[],
	actionName: string,
	classId: number
): number {
	// Build dict key
	const key = actionName + classId;

	// Compute fight action id
	let fightActionId = fightActionsDict[key];

	// If missing, register the fight action
	if (!fightActionId) {
		fightActionId = fightActions.length + 1;
		const fightAction = {
			id: fightActionId,
			name: actionName,
			classId
		};
		fightActions.push(fightAction);
		fightActionsDict[key] = fightActionId;
	}

	return fightActionId;
}

function getMostRecentClassId(history: {
	classId: number; date: number;
}[], maxDate: number): number {
	let maxClass: {
		classId: number; date: number;
	} | null = null;
	for (const c of history) {
		if (!maxClass || c.date < maxDate && c.date > maxClass.date) {
			maxClass = c;
		}
	}

	return maxClass!.classId;
}

async function addClassesToFightActions(context: QueryInterface): Promise<void> {
	// Fight actions that will be created
	const fightActions: {
		id: number; name: string; classId: number;
	}[] = [];

	// The key is the name followed by the classId
	const fightActionsDict: { [key: string]: number } = {};

	// Current logs fight actions
	const fightActionsModel = context.sequelize.define("fights_actions", logsFightsActionsAttributes001, { timestamps: false });
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const currentFightActions: any[] = await fightActionsModel.findAll();
	const currentFightActionsDict: { [actionId: number]: string } = {};
	for (const currentFightAction of currentFightActions) {
		currentFightActionsDict[currentFightAction.id] = currentFightAction.name;
	}

	// Fight id to date
	const logFightsModel = context.sequelize.define("fights_results", logsFightsResultsAttributes001, { timestamps: false });
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const logFights: any[] = await logFightsModel.findAll();
	const fightsDict: { [fightId: number]: {
		player1Id: number; player2Id: number; date: number;
	}; } = {};
	for (const fight of logFights) {
		fightsDict[fight.id] = {
			player1Id: fight.player1Id,
			player2Id: fight.player2Id,
			date: fight.date
		};
	}

	// Fight actions used
	const fightActionsUsedModel = context.sequelize.define("fights_actions_used", logsFightsActionsUsedAttributes002, {
		tableName: "fights_actions_used", timestamps: false
	});
	fightActionsUsedModel.removeAttribute("id");
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const fightActionsUsed: any[] = await fightActionsUsedModel.findAll();
	const newFightActionsUsed: {
		fightId: number; player: number; actionId: number; count: number;
	}[] = [];

	// Players classes history
	const classesHistory = await buildPlayersClassesHistory(context);

	// Update models
	for (const fightActionUsed of fightActionsUsed) {
		const fightActionName = currentFightActionsDict[fightActionUsed.actionId];
		const fightResult = fightsDict[fightActionUsed.fightId];
		const history = classesHistory[fightActionUsed.player === 1 ? fightResult.player1Id : fightResult.player2Id];
		const fightActionClassId = history
			? getMostRecentClassId(
				classesHistory[fightActionUsed.player === 1 ? fightResult.player1Id : fightResult.player2Id],
				fightsDict[fightActionUsed.fightId].date
			)
			: null;
		newFightActionsUsed.push({
			fightId: fightActionUsed.fightId,
			player: fightActionUsed.player,
			actionId: getOrRegisterFightAction(
				fightActionsDict,
				fightActions,
				fightActionName,
				fightActionClassId!
			),
			count: fightActionUsed.count
		});
	}

	// Temp copy if fails
	await context.createTable("fights_actions_used_temp", logsFightsActionsUsedAttributes002);
	await context.sequelize.query("INSERT INTO fights_actions_used_temp SELECT * FROM fights_actions_used");
	await context.createTable("fights_actions_temp", logsFightsActionsAttributes002);
	await context.sequelize.query("INSERT INTO fights_actions_temp SELECT * FROM fights_actions");

	try {
		// Drop and recreate the tables because the id key is now bigger (tinyint -> smallint)
		await context.dropTable("fights_actions");
		await context.dropTable("fights_actions_used");
		await context.createTable("fights_actions", logsFightsActionsAttributes002);
		await context.createTable("fights_actions_used", logsFightsActionsUsedAttributes002);

		// Bulk create
		const newFightActionUsedModel = context.sequelize.define("fights_actions_used", logsFightsActionsUsedAttributes002, {
			tableName: "fights_actions_used", timestamps: false
		});
		newFightActionUsedModel.removeAttribute("id");
		await newFightActionUsedModel.bulkCreate(newFightActionsUsed);
		const newFightActionModel = context.sequelize.define("fights_actions", logsFightsActionsAttributes002, { timestamps: false });
		await newFightActionModel.bulkCreate(fightActions);
	}
	catch (e) {
		await fightActionsUsedModel.destroy({ truncate: true });
		await fightActionsModel.destroy({ truncate: true });
		await context.sequelize.query("INSERT INTO fights_actions_used SELECT * FROM fights_actions_used_temp");
		await context.sequelize.query("INSERT INTO fights_actions SELECT * FROM fights_actions_temp");

		throw e;
	}
	finally {
		await context.dropTable("fights_actions_used_temp");
		await context.dropTable("fights_actions_temp");
	}
}

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	await context.createTable("players_glory_points", {
		playerId: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		value: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		reason: {
			type: DataTypes.TINYINT.UNSIGNED,
			allowNull: false
		},
		fightId: {
			type: DataTypes.INTEGER,
			allowNull: true
		},
		date: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		}
	});

	await context.addColumn("fights_actions", "classId", {
		type: DataTypes.TINYINT.UNSIGNED,
		allowNull: true
	});

	await addClassesToFightActions(context);
	await context.createTable("players_15_best_season", {
		playerId: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		position: {
			type: DataTypes.TINYINT,
			allowNull: false
		},
		seasonGlory: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		date: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		}
	});
	await context.createTable("season_ends", {
		date: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		}
	});
	await context.createTable("league_rewards", {
		playerId: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		leagueLastSeason: {
			type: DataTypes.TINYINT,
			allowNull: false
		},
		date: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		}
	});
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await context.removeColumn("fights_actions", "classId");
	await context.dropTable("players_glory_points");
	await context.dropTable("players_15_best_season");
	await context.dropTable("season_ends");
	await context.dropTable("league_rewards");
}
