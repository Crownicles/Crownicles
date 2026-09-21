import {ReactNode, useState} from "react";
import {Text} from "react-native";
import {ShopOutcome} from "ws-packets/src/fromServer/shop/ShopRes";
import {MarketForecast, marketReport} from "@/src/display/ShopReport";
import {Note, SectionHeader} from "@/src/design/Primitives";
import {ExpandableEntry, ExpandableList, sectionStyles} from "@/src/design/Sections";
import {plainLines, plainStory} from "@/src/display/Markdown";

/** A plant keeps its forecasts folded, so the whole market fits on one screen. */
function PlantForecasts({forecasts}: {forecasts: MarketForecast[]}): ReactNode {
	const [openId, setOpenId] = useState<string>();
	return <ExpandableList>
		{forecasts.map(forecast => <ExpandableEntry
			key={forecast.id}
			label={plainStory(forecast.heading)}
			expanded={openId === forecast.id}
			onToggle={(): void => setOpenId(openId === forecast.id ? undefined : forecast.id)}
		>
			{forecast.lines.map(line => <Text key={line} style={sectionStyles.caption}>{plainStory(line)}</Text>)}
		</ExpandableEntry>)}
	</ExpandableList>;
}

/** The stock exchange report, read as sections rather than as one long parchment. */
export function MarketAnalysis({outcome}: {outcome: Extract<ShopOutcome, {kind: "marketAnalysis"}>}): ReactNode {
	const report = marketReport(outcome);
	return <>
		<Note>{plainStory(report.intro)}</Note>
		<SectionHeader>{plainStory(report.kingsMoneyTitle)}</SectionHeader>
		<Note>{plainLines(report.kingsMoney.join("\n"))}</Note>
		<SectionHeader>{plainStory(report.plantsTitle)}</SectionHeader>
		<PlantForecasts forecasts={report.plants} />
		{report.rotation
			? <>
				<SectionHeader>{plainStory(report.rotation.notice)}</SectionHeader>
				<PlantForecasts forecasts={report.rotation.plants} />
			</>
			: null}
		<Note>{plainStory(report.outro)}</Note>
	</>;
}
