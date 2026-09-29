import {ReactNode, useState} from "react";
import {useRouter} from "expo-router";
import {Text, View} from "react-native";
import {TestListRes} from "ws-packets/src/fromServer/test/TestRes";
import {GAME_ENTITIES} from "@/src/store/GameEntities";
import {TestResult, testCommandSuggestions, useTestConsole} from "@/src/store/useTestCommands";
import {GameQueryContent} from "@/src/components/GameQueryContent";
import {ActionBanner, BackButton, EntryRow, ExpandableList, Standing} from "@/src/design/Sections";
import {Note, Screen, SectionHeader} from "@/src/design/Primitives";
import {TextField} from "@/src/design/Inputs";
import {FormBlock} from "@/src/design/KeyboardAvoidance";
import {Play} from "@/src/design/FightIcons";
import {Theme} from "@/src/design/Theme";
import {createStyles} from "@/src/design/ThemeContext";
import {i18n} from "@/src/translations/i18n";

const useStyles = createStyles(colors => ({
	result: {paddingVertical: Theme.spacing.sm, borderBottomWidth: 1, borderColor: colors.line, gap: Theme.spacing.xs},
	command: {fontFamily: Theme.fonts.semiBold, fontSize: Theme.fontSize.caption, color: colors.muted},
	text: {fontFamily: Theme.fonts.regular, fontSize: Theme.fontSize.note, color: colors.ink},
	error: {color: colors.red}
}));

function ResultLine({result}: {result: TestResult}): ReactNode {
	const styles = useStyles();
	return <View style={styles.result}>
		<Text style={styles.command}>{result.commandName}</Text>
		<Text selectable style={[styles.text, result.isError && styles.error]}>{result.result}</Text>
	</View>;
}

function TestConsoleForm({list, run}: {list: TestListRes; run: (command: string) => void}): ReactNode {
	const [command, setCommand] = useState("");
	if (!list.testMode) return <Note>{i18n.t("app:settings.testCommands.disabled")}</Note>;
	const suggestions = testCommandSuggestions(list.commands, command);
	const send = (): void => {
		if (command.trim().length === 0) return;
		run(command.trim());
	};
	return <FormBlock>
		<TextField
			label={i18n.t("app:settings.testCommands.command")}
			value={command}
			onChangeText={setCommand}
			onSubmitEditing={send}
			returnKeyType="send"
			autoCapitalize="none"
			autoCorrect={false}
		/>
		{suggestions.length > 0 ? <ExpandableList>{suggestions.map(suggestion => <EntryRow
			key={suggestion.name}
			title={suggestion.name}
			{...suggestion.format ?? suggestion.description ? {subtitle: suggestion.format ?? suggestion.description} : {}}
			onPress={(): void => setCommand(`${suggestion.name} `)}
		/>)}</ExpandableList> : null}
		<ActionBanner icon={Play} label={i18n.t("app:settings.testCommands.run")} disabled={command.trim().length === 0} onPress={send} />
	</FormBlock>;
}

export default function TestCommands(): ReactNode {
	const router = useRouter();
	const {list, results, run, clear} = useTestConsole();
	return <Screen>
		<BackButton label={i18n.t("app:common.back")} onClose={router.back} />
		<Standing caption={i18n.t("app:settings.developerMode")} title={i18n.t("app:settings.testCommands.title")} subtitle={i18n.t("app:settings.testCommands.hint")} />
		<GameQueryContent state={list} entity={GAME_ENTITIES.TEST_COMMANDS}>{data => <TestConsoleForm list={data} run={run} />}</GameQueryContent>
		{results.length > 0
			? <>
				<SectionHeader action={{label: i18n.t("app:settings.testCommands.clear"), onPress: clear}}>{i18n.t("app:settings.testCommands.results")}</SectionHeader>
				{results.map(result => <ResultLine key={result.id} result={result} />)}
			</>
			: null}
	</Screen>;
}
