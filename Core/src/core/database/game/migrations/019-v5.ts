import {
	DataTypes, Op, QueryInterface
} from "sequelize";
import {
	classesAttributes001, itemAttributes001, missionsAttributes001, petAttributes001
} from "./001-initial-database";
import { leaguesAttributes008 } from "./008-glory-and-league";
import { monsterLocationsAttributes011 } from "./011-pve";
import { existsSync } from "node:fs";
import { parse } from "toml";
import { readFileSync } from "fs";
import { KeycloakUtils } from "../../../../../../Lib/src/keycloak/KeycloakUtils";
import { KeycloakConfig } from "../../../../../../Lib/src/keycloak/KeycloakConfig";
import { logsV5NewIds } from "../../logs/migrations/007-v5";
import { LANGUAGE } from "../../../../../../Lib/src/Language";
import { Effect } from "../../../../../../Lib/src/types/Effect";
import { CrowniclesLogger } from "../../../../../../Lib/src/logs/CrowniclesLogger";
import { KeycloakUser } from "../../../../../../Lib/src/keycloak/KeycloakUser";

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	// Delete players with a score < 100 and that are not banned
	await context.bulkDelete("players", {
		score: { [Op.lt]: 100 },
		effectEndDate: {
			[Op.lt]: new Date(2050, 0, 1)
		}
	});

	const players = await context.select(null, "players") as { [key: string]: unknown }[];

	if (players.length !== 0) {
		const configPath = `${process.cwd()}/config/keycloak.toml`;
		if (!existsSync(configPath)) {
			CrowniclesLogger.error(`Please first backup your database. Then, in order to migrate from v4 to v5, please create a file at '${configPath}' with the following format:\n[keycloak]\nrealm = "Crownicles"\nurl = "http://127.0.0.1:8080"\nclientId = "discord"\nclientSecret = "secret"`);
			process.exit(1);
		}

		const config: { keycloak: KeycloakConfig } = parse(readFileSync(configPath, "utf-8")) as {
			keycloak: KeycloakConfig;
		};

		for (let i = 0; i < players.length; ++i) {
			const player = players[i];
			const getUser = await KeycloakUtils.getOrRegisterDiscordUser(config.keycloak, player.discordUserId as string, "Pseudo 404", LANGUAGE.DEFAULT_LANGUAGE);
			if (getUser.isError) {
				CrowniclesLogger.errorWithObj("Error while migrating user", getUser);
				process.exit(1);
			}
			const { user } = getUser.payload as { user: KeycloakUser };
			await context.sequelize.query(`UPDATE players SET discordUserId = "${user.id}" WHERE discordUserId = "${player.discordUserId}"`);
			logsV5NewIds.set(player.discordUserId as string, user.id);
		}
	}

	await context.renameColumn("players", "discordUserId", "keycloakId");

	// Migrate to new effect names
	for (const effect of Effect.getAll()) {
		await context.sequelize.query(`UPDATE players SET effect = "${effect.id}" WHERE effect = "${effect.v4Id}"`);
	}

	await context.renameColumn("players", "effect", "effectId");
	await context.renameColumn("pet_entities", "petId", "typeId");

	await context.dropTable("armors");
	await context.dropTable("classes");
	await context.dropTable("leagues");
	await context.dropTable("map_links");
	await context.dropTable("map_locations");
	await context.dropTable("missions");
	await context.dropTable("monsters");
	await context.dropTable("monster_attacks");
	await context.dropTable("monster_locations");
	await context.dropTable("objects");
	await context.dropTable("pets");
	await context.dropTable("potions");
	await context.dropTable("weapons");
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await context.createTable("armors", itemAttributes001);
	await context.createTable("classes", classesAttributes001);
	await context.createTable("leagues", leaguesAttributes008);
	await context.createTable("map_links", {
		id: {
			type: DataTypes.INTEGER,
			primaryKey: true
		},
		startMap: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		endMap: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		tripDuration: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		forcedImage: {
			type: DataTypes.TEXT,
			allowNull: true
		},
		updatedAt: DataTypes.DATE,
		createdAt: DataTypes.DATE
	});
	await context.createTable("map_locations", {
		id: {
			type: DataTypes.INTEGER,
			primaryKey: true
		},
		type: {
			type: DataTypes.TEXT,
			allowNull: false
		},
		nameFr: {
			type: DataTypes.TEXT,
			allowNull: false
		},
		nameEn: {
			type: DataTypes.TEXT,
			allowNull: false
		},
		descFr: {
			type: DataTypes.TEXT,
			allowNull: false
		},
		descEn: {
			type: DataTypes.TEXT,
			allowNull: false
		},
		particleFr: {
			type: DataTypes.TEXT,
			allowNull: false
		},
		particleEn: {
			type: DataTypes.TEXT,
			allowNull: false
		},
		canBeGoToPlaceMissionDestination: {
			type: DataTypes.BOOLEAN,
			allowNull: false
		},
		attribute: {
			type: DataTypes.TEXT,
			allowNull: false
		},
		forcedImage: {
			type: DataTypes.TEXT,
			allowNull: true
		},
		updatedAt: DataTypes.DATE,
		createdAt: DataTypes.DATE
	});
	await context.createTable("missions", missionsAttributes001);
	await context.createTable("monsters", {
		id: {
			// eslint-disable-next-line new-cap
			type: DataTypes.STRING(64),
			primaryKey: true
		},
		fr: {
			// eslint-disable-next-line new-cap
			type: DataTypes.STRING(64),
			allowNull: false
		},
		en: {
			// eslint-disable-next-line new-cap
			type: DataTypes.STRING(64),
			allowNull: false
		},
		fightPointsRatio: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		attackRatio: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		defenseRatio: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		speedRatio: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		breath: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		maxBreath: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		breathRegen: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		updatedAt: DataTypes.DATE,
		createdAt: DataTypes.DATE
	});
	await context.createTable("monster_attacks", {
		monsterId: {
			// eslint-disable-next-line new-cap
			type: DataTypes.STRING(64),
			allowNull: false
		},
		attackId: {
			// eslint-disable-next-line new-cap
			type: DataTypes.STRING(64),
			allowNull: false
		},
		minLevel: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		weight: {
			type: DataTypes.INTEGER,
			allowNull: false,
			defaultValue: 1
		},
		updatedAt: DataTypes.DATE,
		createdAt: DataTypes.DATE
	});
	await context.createTable("monster_locations", monsterLocationsAttributes011);
	await context.createTable("objects", itemAttributes001);
	await context.createTable("pets", petAttributes001);
	await context.createTable("potions", itemAttributes001);
	await context.createTable("weapons", itemAttributes001);

	await context.renameColumn("pet_entities", "typeId", "petId");
}
