import {
	DataTypes, Model, Op, Sequelize
} from "sequelize";

// skipcq: JS-C1003 - moment does not expose itself as an ES Module.
import moment from "moment";
import {
	PUSH_TOKEN_MAX_LENGTH, PushDevice, PushPlatform
} from "../../../../../../Lib/src/types/PushDevices";
import { Language } from "../../../../../../Lib/src/Language";

/**
 * A device the app can push the player's notifications to. The token identifies the device for its
 * push service: it belongs to the last player who logged in on it.
 */
export class AppPushDevice extends Model {
	declare readonly token: string;

	declare keycloakId: string;

	declare platform: PushPlatform;

	declare sandbox: boolean;

	declare language: Language;

	declare updatedAt: Date;

	declare createdAt: Date;
}

export function pushDeviceOf(row: AppPushDevice): PushDevice {
	return {
		token: row.token,
		platform: row.platform,
		sandbox: row.sandbox,
		language: row.language
	};
}

export abstract class AppPushDevices {
	/** Binds the device to the player; a device another player logged out of without saying so moves over. */
	static async register(keycloakId: string, device: PushDevice): Promise<void> {
		await AppPushDevice.upsert({
			...device,
			keycloakId
		});
	}

	/** Forgets the device, only if it is still the player's: another player may have logged in on it since. */
	static async unregister(keycloakId: string, token: string): Promise<void> {
		await AppPushDevice.destroy({
			where: {
				token, keycloakId
			}
		});
	}

	/** The devices of each player, for those who have any. */
	static async ofPlayers(keycloakIds: string[]): Promise<Map<string, PushDevice[]>> {
		const devices = new Map<string, PushDevice[]>();
		if (keycloakIds.length === 0) {
			return devices;
		}
		const rows = await AppPushDevice.findAll({ where: { keycloakId: { [Op.in]: keycloakIds } } });
		for (const row of rows) {
			devices.set(row.keycloakId, [...devices.get(row.keycloakId) ?? [], pushDeviceOf(row)]);
		}
		return devices;
	}

	static async ofPlayer(keycloakId: string): Promise<AppPushDevice[]> {
		return await AppPushDevice.findAll({ where: { keycloakId } });
	}
}

export function initModel(sequelize: Sequelize): void {
	AppPushDevice.init({
		token: {
			// eslint-disable-next-line new-cap
			type: DataTypes.STRING(PUSH_TOKEN_MAX_LENGTH),
			primaryKey: true
		},
		keycloakId: {
			// eslint-disable-next-line new-cap
			type: DataTypes.STRING(64),
			allowNull: false
		},
		platform: {
			// eslint-disable-next-line new-cap
			type: DataTypes.STRING(16),
			allowNull: false
		},
		sandbox: {
			type: DataTypes.BOOLEAN,
			allowNull: false,
			defaultValue: false
		},
		language: {
			// eslint-disable-next-line new-cap
			type: DataTypes.STRING(8),
			allowNull: false
		},
		updatedAt: {
			type: DataTypes.DATE,
			defaultValue: moment()
				.format("YYYY-MM-DD HH:mm:ss")
		},
		createdAt: {
			type: DataTypes.DATE,
			defaultValue: moment()
				.format("YYYY-MM-DD HH:mm:ss")
		}
	}, {
		sequelize,
		tableName: "app_push_devices",
		freezeTableName: true
	});
}

export default AppPushDevice;
