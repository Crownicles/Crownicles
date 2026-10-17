import {
	DataTypes, QueryInterface
} from "sequelize";
import { LANGUAGE } from "../../../../../../Lib/src/Language";

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	await context.addColumn("tournaments", "language", {
		// eslint-disable-next-line new-cap
		type: DataTypes.STRING(8),
		allowNull: false,
		defaultValue: LANGUAGE.DEFAULT_LANGUAGE
	});
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await context.removeColumn("tournaments", "language");
}
