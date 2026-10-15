import { ReactNode } from "react";
import {
	Text, View
} from "react-native";
import { AppIcons } from "@/src/AppIcons";
import { Theme } from "@/src/design/Theme";
import {
	createStyles, useColors
} from "@/src/design/ThemeContext";
import {
	ActionBanner, Card, Fact
} from "@/src/design/Sections";
import { Note } from "@/src/design/Primitives";
import {
	AtSign, Check, LucideIcon, MessageCircle
} from "@/src/design/FightIcons";
import { formatNumber } from "@/src/display/Amounts";
import { i18n } from "@/src/translations/i18n";
import {
	ACCOUNT_COLLISION_CHOICES, AccountCollisionChoice, CollisionAccount, CollisionAccountAdventure
} from "ws-packets/src/objects/AccountCollision";

const ACCOUNT_ICONS = {
	[ACCOUNT_COLLISION_CHOICES.DISCORD]: MessageCircle,
	[ACCOUNT_COLLISION_CHOICES.EMAIL]: AtSign
} as const satisfies Record<AccountCollisionChoice, LucideIcon>;

const EMBLEM_SIZE = 44;
const EMBLEM_ICON_SIZE = 20;

const useStyles = createStyles(colors => ({
	head: {
		flexDirection: "row", alignItems: "center", gap: Theme.spacing.md, padding: Theme.spacing.lg
	},
	emblem: {
		width: EMBLEM_SIZE, height: EMBLEM_SIZE, flexShrink: 0, borderRadius: EMBLEM_SIZE / 2, alignItems: "center", justifyContent: "center", backgroundColor: colors.wash
	},
	body: {
		flex: 1, minWidth: 0, gap: 2
	},
	kind: {
		fontFamily: Theme.fonts.medium, fontSize: Theme.fontSize.caption, lineHeight: Theme.lineHeight.rowSubtitle, color: colors.muted
	},
	name: {
		fontFamily: Theme.fonts.bold, fontSize: Theme.fontSize.title, lineHeight: Theme.lineHeight.body, color: colors.ink
	},
	current: {
		flexShrink: 0, paddingVertical: Theme.spacing.chipVertical, paddingHorizontal: Theme.spacing.chipHorizontal, borderRadius: Theme.pillRadius, backgroundColor: colors.greenWash
	},
	currentText: {
		fontFamily: Theme.fonts.semiBold, fontSize: Theme.fontSize.caption, color: colors.green
	},
	action: {
		paddingHorizontal: Theme.spacing.lg, paddingTop: Theme.spacing.sm, paddingBottom: Theme.spacing.lg
	}
}));

/** Keeping the account: pressed, the other one is deleted once the player proved it is theirs too. */
export type KeepAccountAction = {
	detail?: string; pending: boolean; disabled: boolean; onPress: () => void;
};

function classLabel(classId: number): string {
	const icon = AppIcons.getIconOrNull(`classes.${classId}`);
	const name = i18n.t(`models:classes.${classId}`);
	return icon ? `${icon} ${name}` : name;
}

function creationDate(createdAt: number): string {
	return new Intl.DateTimeFormat(i18n.language, { dateStyle: "long" }).format(createdAt);
}

/** An account without progression is told apart from one whose progression the game could not tell, or has not told yet. */
function progressionNote(account: CollisionAccount, previewing: boolean): string {
	if (previewing) {
		return i18n.t("app:common.loading");
	}
	return i18n.t(account.progressionAvailable ? "app:auth.collision.noAdventure" : "app:auth.collision.progressionUnavailable");
}

function AdventureFacts({ adventure }: { adventure: CollisionAccountAdventure }): ReactNode {
	return <>
		<Fact label={i18n.t("app:auth.collision.fields.level")} value={formatNumber(adventure.level)} />
		<Fact label={i18n.t("app:auth.collision.fields.class")} end={classLabel(adventure.classId)} />
		<Fact label={i18n.t("app:auth.collision.fields.score")} value={formatNumber(adventure.score)} unit="score" />
	</>;
}

function AccountHead({
	kind, name, current
}: {
	kind: AccountCollisionChoice; name: string; current: boolean;
}): ReactNode {
	const styles = useStyles();
	const colors = useColors();
	const Icon = ACCOUNT_ICONS[kind];
	return <View style={styles.head}>
		<View style={styles.emblem}><Icon size={EMBLEM_ICON_SIZE} color={colors.ink} /></View>
		<View style={styles.body}>
			<Text style={styles.kind}>{i18n.t(`app:auth.collision.accounts.${kind}`)}</Text>
			<Text style={styles.name} numberOfLines={1}>{name}</Text>
		</View>
		{current
			? <View style={styles.current}><Text style={styles.currentText}>{i18n.t("app:auth.collision.current")}</Text></View>
			: null}
	</View>;
}

/** One of the two accounts, told apart by what the player remembers of it: its name, where it stands, when it began. */
export function CollisionAccountCard({
	kind, account, previewing, current, keep
}: {
	kind: AccountCollisionChoice;
	account: CollisionAccount;
	previewing: boolean;
	current: boolean;
	keep: KeepAccountAction;
}): ReactNode {
	const styles = useStyles();
	return <Card>
		<View testID={`collision-account-${kind}`}>
			<AccountHead kind={kind} name={account.name} current={current} />
			{account.adventure ? <AdventureFacts adventure={account.adventure} /> : <Note>{progressionNote(account, previewing)}</Note>}
			<Fact label={i18n.t("app:auth.collision.fields.createdAt")} value={creationDate(account.createdAt)} />
			<View style={styles.action}>
				<ActionBanner
					icon={Check}
					label={i18n.t("app:auth.collision.keep")}
					detail={keep.detail}
					pending={keep.pending}
					disabled={keep.disabled}
					onPress={keep.onPress}
				/>
			</View>
		</View>
	</Card>;
}
