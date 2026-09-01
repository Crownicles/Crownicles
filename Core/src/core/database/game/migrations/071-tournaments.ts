import {
	DataTypes, QueryInterface
} from "sequelize";

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	await context.createTable("tournament_codes", {
		id: {
			type: DataTypes.INTEGER,
			primaryKey: true,
			autoIncrement: true
		},
		codeHash: {
			// eslint-disable-next-line new-cap
			type: DataTypes.STRING(64),
			allowNull: false,
			unique: true
		},
		discordGuildId: {
			// eslint-disable-next-line new-cap
			type: DataTypes.STRING(32),
			allowNull: false
		},
		expiresAt: {
			type: DataTypes.DATE,
			allowNull: false
		},
		consumedAt: {
			type: DataTypes.DATE,
			allowNull: true
		},
		createdAt: {
			type: DataTypes.DATE,
			allowNull: false
		},
		updatedAt: {
			type: DataTypes.DATE,
			allowNull: false
		}
	});

	await context.createTable("tournaments", {
		id: {
			type: DataTypes.INTEGER,
			primaryKey: true,
			autoIncrement: true
		},
		discordGuildId: {
			// eslint-disable-next-line new-cap
			type: DataTypes.STRING(32),
			allowNull: false
		},
		discordChannelId: {
			// eslint-disable-next-line new-cap
			type: DataTypes.STRING(32),
			allowNull: false
		},
		createdByKeycloakId: {
			// eslint-disable-next-line new-cap
			type: DataTypes.STRING(64),
			allowNull: false
		},
		status: {
			// eslint-disable-next-line new-cap
			type: DataTypes.STRING(16),
			allowNull: false
		},
		pausedFromStatus: {
			// eslint-disable-next-line new-cap
			type: DataTypes.STRING(16),
			allowNull: true
		},
		registrationEndsAt: {
			type: DataTypes.DATE,
			allowNull: false
		},
		combatEndsAt: {
			type: DataTypes.DATE,
			allowNull: false
		},
		pausedRemainingMs: {
			type: DataTypes.INTEGER,
			allowNull: true
		},
		startedNotificationSent: {
			type: DataTypes.BOOLEAN,
			allowNull: false,
			defaultValue: false
		},
		endingNotificationSent: {
			type: DataTypes.BOOLEAN,
			allowNull: false,
			defaultValue: false
		},
		endedNotificationSent: {
			type: DataTypes.BOOLEAN,
			allowNull: false,
			defaultValue: false
		},
		rewardsDistributed: {
			type: DataTypes.BOOLEAN,
			allowNull: false,
			defaultValue: false
		},
		createdAt: {
			type: DataTypes.DATE,
			allowNull: false
		},
		updatedAt: {
			type: DataTypes.DATE,
			allowNull: false
		}
	});

	await context.createTable("tournament_participants", {
		id: {
			type: DataTypes.INTEGER,
			primaryKey: true,
			autoIncrement: true
		},
		tournamentId: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		playerId: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		keycloakId: {
			// eslint-disable-next-line new-cap
			type: DataTypes.STRING(64),
			allowNull: false
		},
		category: {
			// eslint-disable-next-line new-cap
			type: DataTypes.STRING(16),
			allowNull: false
		},
		lateRegistration: {
			type: DataTypes.BOOLEAN,
			allowNull: false,
			defaultValue: false
		},
		normalLeagueId: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		attackGloryPoints: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		defenseGloryPoints: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		finalRank: {
			type: DataTypes.INTEGER,
			allowNull: true
		},
		isWinner: {
			type: DataTypes.BOOLEAN,
			allowNull: false,
			defaultValue: false
		},
		rewardXp: {
			type: DataTypes.INTEGER,
			allowNull: false,
			defaultValue: 0
		},
		rewardMoney: {
			type: DataTypes.INTEGER,
			allowNull: false,
			defaultValue: 0
		},
		rewardItemCount: {
			type: DataTypes.INTEGER,
			allowNull: false,
			defaultValue: 0
		},
		rewardGrantedAt: {
			type: DataTypes.DATE,
			allowNull: true
		},
		registeredAt: {
			type: DataTypes.DATE,
			allowNull: false
		},
		createdAt: {
			type: DataTypes.DATE,
			allowNull: false
		},
		updatedAt: {
			type: DataTypes.DATE,
			allowNull: false
		}
	});

	await context.createTable("tournament_fights", {
		id: {
			type: DataTypes.INTEGER,
			primaryKey: true,
			autoIncrement: true
		},
		tournamentId: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		attackerParticipantId: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		defenderParticipantId: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		winnerParticipantId: {
			type: DataTypes.INTEGER,
			allowNull: true
		},
		draw: {
			type: DataTypes.BOOLEAN,
			allowNull: false
		},
		playedAt: {
			type: DataTypes.DATE,
			allowNull: false
		},
		createdAt: {
			type: DataTypes.DATE,
			allowNull: false
		},
		updatedAt: {
			type: DataTypes.DATE,
			allowNull: false
		}
	});

	await context.addIndex("tournament_codes", ["discordGuildId", "expiresAt"], {
		name: "idx_tournament_codes_guild_expires"
	});
	await context.addIndex("tournaments", ["discordGuildId", "status"], {
		name: "idx_tournaments_guild_status"
	});
	await context.addIndex("tournament_participants", ["tournamentId", "playerId"], {
		name: "uniq_tournament_participants_tournament_player",
		unique: true
	});
	await context.addIndex("tournament_participants", ["tournamentId", "category"], {
		name: "idx_tournament_participants_tournament_category"
	});
	await context.addIndex("tournament_fights", [
		"tournamentId",
		"attackerParticipantId",
		"defenderParticipantId"
	], {
		name: "idx_tournament_fights_pair"
	});
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await context.removeIndex("tournament_fights", "idx_tournament_fights_pair");
	await context.removeIndex("tournament_participants", "idx_tournament_participants_tournament_category");
	await context.removeIndex("tournament_participants", "uniq_tournament_participants_tournament_player");
	await context.removeIndex("tournaments", "idx_tournaments_guild_status");
	await context.removeIndex("tournament_codes", "idx_tournament_codes_guild_expires");
	await context.dropTable("tournament_fights");
	await context.dropTable("tournament_participants");
	await context.dropTable("tournaments");
	await context.dropTable("tournament_codes");
}
