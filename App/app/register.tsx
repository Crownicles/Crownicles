import {
	Alert, StyleSheet, View
} from "react-native";
import {Image} from "expo-image";
import React from "react";
import {useRouter} from "expo-router";
import crowniclesLogo from "@/assets/images/icon.png";
import {
	AccountDraft, MINIMUM_PASSWORD_LENGTH, REGISTRATION_FAILURES,
	RegistrationFailure, draftRejection, registerAccount
} from "@/src/authentication/Registration";
import {useTranslationsReady} from "@/src/translations/useTranslationsReady";
import {Theme} from "@/src/design/Theme";
import {
	Button, Screen
} from "@/src/design/Primitives";
import {TextField} from "@/src/design/Inputs";
import {
	ActionBanner, Standing
} from "@/src/design/Sections";
import {
	Info, Star, UserPlus
} from "@/src/design/FightIcons";
import {i18n} from "@/src/translations/i18n";

const styles = StyleSheet.create({
	screen: {
		flexGrow: 1,
		justifyContent: "center"
	},
	emblem: {
		width: 64,
		height: 64,
		borderRadius: 8
	},
	form: {
		marginTop: Theme.spacing.lg
	},
	submit: {
		marginTop: Theme.spacing.lg
	}
});

const EMPTY_DRAFT: AccountDraft = {
	username: "",
	email: "",
	password: ""
};

function reasonOfUnknownError(error: unknown): string {
	return error instanceof RegistrationFailure ? error.reason : REGISTRATION_FAILURES.UNKNOWN;
}

export default function RegisterScreen(): React.ReactElement {
	const router = useRouter();
	const [draft, setDraft] = React.useState<AccountDraft>(EMPTY_DRAFT);
	const [pending, setPending] = React.useState(false);
	const [sent, setSent] = React.useState(false);

	useTranslationsReady();

	// Functional update: two fields changed in the same batch would otherwise overwrite each other.
	const edit = (field: keyof AccountDraft) => (value: string): void => {
		setDraft(previous => ({
			...previous,
			[field]: value
		}));
	};

	const leave = (): void => {
		router.back();
	};

	if (sent) {
		return (
			<Screen contentContainerStyle={styles.screen}>
				<Standing
					emblem={<Star size={40} color={Theme.colors.gold} />}
					caption={i18n.t("app:register.caption")}
					title={i18n.t("app:register.sent.title")}
					subtitle={i18n.t("app:register.sent.body", {email: draft.email.trim()})}
				/>
				<View style={styles.submit}>
					<Button variant="primary" onPress={leave}>{i18n.t("app:register.sent.back")}</Button>
				</View>
			</Screen>
		);
	}

	const rejection = draftRejection(draft);

	const submit = (): void => {
		setPending(true);
		registerAccount(draft)
			.then((): void => {
				setSent(true);
			})
			.catch((error: unknown) => {
				Alert.alert(i18n.t("app:register.failed"), i18n.t(`app:register.failures.${reasonOfUnknownError(error)}`));
			})
			.finally((): void => {
				setPending(false);
			});
	};

	return (
		<Screen contentContainerStyle={styles.screen}>
			<Standing
				emblem={<Image source={crowniclesLogo} style={styles.emblem} contentFit="cover" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />}
				caption={i18n.t("app:register.caption")}
				title={i18n.t("app:register.title")}
				subtitle={i18n.t("app:register.subtitle")}
			/>
			<View style={styles.form}>
				<TextField
					label={i18n.t("app:register.fields.username")}
					value={draft.username}
					onChangeText={edit("username")}
					autoCapitalize="none"
					autoComplete="username"
					textContentType="nickname"
				/>
				<TextField
					label={i18n.t("app:register.fields.email")}
					value={draft.email}
					onChangeText={edit("email")}
					keyboardType="email-address"
					autoCapitalize="none"
					autoComplete="email"
					textContentType="emailAddress"
				/>
				<TextField
					label={i18n.t("app:register.fields.password", {minimum: MINIMUM_PASSWORD_LENGTH})}
					value={draft.password}
					onChangeText={edit("password")}
					secureTextEntry
					autoCapitalize="none"
					autoComplete="new-password"
					textContentType="newPassword"
				/>
			</View>
			<View style={styles.submit}>
				<ActionBanner
					icon={UserPlus}
					label={pending ? i18n.t("app:register.pending") : i18n.t("app:register.submit")}
					pending={pending}
					onPress={submit}
					testID="register-submit"
					{...rejection && !pending
						? {
							lock: {
								reason: i18n.t(`app:register.requirements.${rejection}`, {minimum: MINIMUM_PASSWORD_LENGTH}),
								icon: Info
							}
						}
						: {}}
				/>
				<Button onPress={leave}>{i18n.t("app:register.back")}</Button>
			</View>
		</Screen>
	);
}
