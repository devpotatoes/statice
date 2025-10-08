import * as vscode from "vscode";
import * as fs from "fs";
import * as zlib from "zlib";

interface Lib {
	name: string;
	version: string;
	extension: string;
	path: string;
	defered: boolean;
}

const libsArray = [
	{
		name: "wco",
		version: "1.0.0",
		extension: "min.js",
		path: "/libs", 
		defered: false
	}
];

const extensionVersion = "2.4.0";
const gitHubIssuesUrl = "https://github.com/devpotatoes/statice/issues";

const getHelpActionBtnObj = {
	label: "Get Help",
	action: () => {
		vscode.env.openExternal(vscode.Uri.parse(gitHubIssuesUrl));
	}
};

let colorVariablesObj: { [key: string]: string } = {};

async function newActionNotification(type: string, message: string, btns: { label: string; action: () => void; }[] = []) {
	const buttonLabelsArray = btns.map(btn => btn.label);

	let action = undefined;

	if (type === "info") {
		action = await vscode.window.showInformationMessage(message, ...buttonLabelsArray);
	} else if (type === "warn") {
		action = await vscode.window.showWarningMessage(message, ...buttonLabelsArray);
	} else if (type === "error") {
		action = await vscode.window.showErrorMessage(message, ...buttonLabelsArray);
	};
	
	if (action !== undefined) {
		btns.find(btn => btn.label === action)?.action();
	};
};

async function checkExtensionData(extensionPath: string) {
	if (fs.existsSync(`${extensionPath}/data/stats.json`) !== true) {
		try {
			fs.mkdirSync(`${extensionPath}/data`);
		} catch (error) {
			await newActionNotification("error", "An error have occurred when launching the Statice extension.", [getHelpActionBtnObj]);
		};

		const dataObj = {
			extensionVersion: extensionVersion,
			programmingLanguagesArray: [],
			projectsArray: [],
			historyArray: []
		};

		try {
			fs.writeFileSync(`${extensionPath}/data/stats.json`, JSON.stringify(dataObj), "utf8");
		} catch (error) {
			await newActionNotification("error", "An error have occurred when launching the Statice extension.", [getHelpActionBtnObj]);
		};
	};

	if (fs.existsSync(`${extensionPath}/data/temp`) !== true) {
		try {
			fs.mkdirSync(`${extensionPath}/data/temp`);
		} catch (error) {
			await newActionNotification("error", "An error have occurred when launching the Statice extension.", [getHelpActionBtnObj]);
		};
	};

	if (fs.existsSync(`${extensionPath}/data/backups`) !== true) {
		try {
			fs.mkdirSync(`${extensionPath}/data/backups`);
		} catch (error) {
			await newActionNotification("error", "An error have occurred when launching the Statice extension.", [getHelpActionBtnObj]);
		};
	};
};

async function checkUpdates(extensionPath: string) {
	try {
		let statsFileData = "";
	
		if (fs.existsSync(`${extensionPath}/data/stats.json`) === true) {
			statsFileData = fs.readFileSync(`${extensionPath}/data/stats.json`, "utf8");
		} else {
			statsFileData = fs.readFileSync(`${extensionPath}/src/data/stats.json`, "utf8");
		};
	
		const statsFileObj = JSON.parse(statsFileData);
		statsFileObj.extensionVersion = statsFileObj.extensionVersion || "1.0.0";

		const oldExtensionVersion = statsFileObj.extensionVersion;
	
		if (statsFileObj.extensionVersion !== extensionVersion) {
			const migrationsArray: { version: string; migrateData: (statsFileObj: { [key: string]: any }) => void; }[] = [
				{
					version: "1.0.0",
					migrateData: () => {}
				},
				{
					version: "2.0.0",
					migrateData: (statsFileObj) => {
						statsFileObj.extensionVersion = "2.0.0";
	
						delete statsFileObj.totalTime;
	
						statsFileObj.programmingLanguagesArray = statsFileObj.codeTypesList;
						delete statsFileObj.codeTypesList;
	
						statsFileObj.programmingLanguagesArray = statsFileObj.programmingLanguagesArray.map((fileTypeObj: { [key: string]: any }) => ({
							extension: fileTypeObj.type,
							time: fileTypeObj.time
						}));
	
						statsFileObj.projectsArray = statsFileObj.projectsList;
						delete statsFileObj.projectsList;
	
						statsFileObj.projectsArray = statsFileObj.projectsArray.map((projectObj: { [key: string]: any }) => ({
							name: projectObj.name,
							time: projectObj.time * 60
						}));
	
						statsFileObj.historyArray = statsFileObj.history;
						delete statsFileObj.history;
	
						statsFileObj.historyArray = statsFileObj.historyArray.map((dayObj: { [key: string]: any }) => ({
							date: dayObj.date,
							time: dayObj.time * 60
						}));
					}
				},
				{
					
					version: "2.1.0",
					migrateData: () => {
						statsFileObj.extensionVersion = "2.1.0";
					}
				},
				{
					
					version: "2.2.0",
					migrateData: () => {
						statsFileObj.extensionVersion = "2.2.0";
	
						fs.rmSync(`${extensionPath}/src/data/`, { recursive: true, force: true });
					}
				},
				{
					version: "2.3.0",
					migrateData: () => {
						statsFileObj.extensionVersion = "2.3.0";
					}
				},
				{
					version: "2.3.1",
					migrateData: () => {
						statsFileObj.extensionVersion = "2.3.1";
					}
				},
				{
					version: "2.4.0",
					migrateData: () => {
						statsFileObj.extensionVersion = "2.4.0";
					}
				}
			];
	
			const currentVersionIndex = migrationsArray.findIndex(migrationObj => migrationObj.version === statsFileObj.extensionVersion);
	
			for (let i = currentVersionIndex + 1; i < migrationsArray.length; i += 1) {
				const migrationObj = migrationsArray[i];
				migrationObj.migrateData(statsFileObj);
	
				fs.writeFileSync(`${extensionPath}/data/stats.json`, JSON.stringify(statsFileObj), "utf8");
			};
			
			newActionNotification("info", `Statice has been updated from version ${oldExtensionVersion} to version ${extensionVersion} !`);
		};
	} catch (error) {
		await newActionNotification("error", "An error have occurred while updating the Statice extension.", [getHelpActionBtnObj]);
	};
};

async function createBackup(extensionPath: string) {
	if (vscode.workspace.getConfiguration().get("statice.backups") === true) {
		const currentDate = new Date();
		const todayDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
		const timestamp = todayDate.getTime();
	
		try {
			const statsFileData = fs.readFileSync(`${extensionPath}/data/stats.json`, "utf8");
			
			JSON.parse(statsFileData);
			
			const fileSize = fs.statSync(`${extensionPath}/data/stats.json`).size;
	
			const backupData = zlib.gzipSync(Buffer.from(statsFileData, "utf8"));
	
			const backupsFileNameArray = fs.readdirSync(`${extensionPath}/data/backups`);
	
			backupsFileNameArray.forEach(fileName => {
				if (fileName.split("_")[0] === timestamp.toString()) {
					fs.rmSync(`${extensionPath}/data/backups/${fileName}`);
				};
			});
	
			fs.writeFileSync(`${extensionPath}/data/backups/${timestamp}_${fileSize}.gz`, backupData);
		} catch (error) {
			await newActionNotification("warning", "Statice failed to create a backup of your stats due to an unexpected issue.");
		};
	};
};

async function manageBackups(extensionPath: string) {
	if (vscode.workspace.getConfiguration().get("statice.backups") === true) {
		try {
			const backupsArray = fs.readdirSync(`${extensionPath}/data/backups`);
			
			if (backupsArray.length > 7) {
				const backupsTimestampsArray = backupsArray.map(fileName => Number(fileName.split("_")[0])).sort();
				const oldestBackupFileName = backupsArray.find(fileName => Number(fileName.split("_")[0]) === backupsTimestampsArray[0]); 

				fs.rmSync(`${extensionPath}/data/backups/${oldestBackupFileName}`)
			};
		} catch (error) {
			await newActionNotification("error", "Statice failed to manage your backups due to an unexpected issue.", [getHelpActionBtnObj]);
		};
	};
};

async function newProgressNotification(duration: number, message: string, forced: boolean = false) {
	if (forced === true || vscode.workspace.getConfiguration().get("statice.notifications") === true) {
		await vscode.window.withProgress(
			{
				location: vscode.ProgressLocation.Notification,
				cancellable: false
			},
			async (progress) => {
				const steps = (duration / 1000) * 10;
				const stepDuration = duration / steps;
				const increment = 100 / steps;

				progress.report(
					{
						increment: 0,
						message: message
					}
				);

				for (let i = 1; i <= steps; i += 1) {
					await new Promise((resolve) => setTimeout(resolve, stepDuration));

					progress.report(
						{
							increment: increment,
							message: message
						}
					);
				};
			}
		);
	};
};

export async function activate(context: vscode.ExtensionContext) {
	const extensionPath = context.extensionPath;
	
	await checkExtensionData(extensionPath);
	await checkUpdates(extensionPath);
	await createBackup(extensionPath);
	await manageBackups(extensionPath);

	let sessionCodingTime = 0;
	const tempStatsArray: {
		extension: string,
		time: number
	}[] = [];

	let statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
	statusBarItem.text = "$(info) Statice";
    statusBarItem.tooltip = "Statice is running.";
	statusBarItem.show();

	let isWindowFocused = true;

	let inactiveTimer = 0;
	let isInactive = false;
	const inactiveThreshold = 60;

	vscode.window.onDidChangeWindowState(windowState => {
		isWindowFocused = windowState.focused;
		
		if (isWindowFocused === true) {
			inactiveTimer = 0;
			isInactive = false;
		};
	});

	setInterval(() => {
		if ((vscode.workspace.getConfiguration().get("statice.trackOnlyWhenFocused") === false) || (isInactive === false && isWindowFocused === true)) { 
			const activeTextEditorObj = vscode.window.activeTextEditor;
			
			if (activeTextEditorObj !== undefined) {
				const fileExtension = activeTextEditorObj.document.uri.path.split(".").pop();
				const fileTypeIndex = tempStatsArray.findIndex(fileTypeObj => fileTypeObj.extension === fileExtension);
	
				if (fileTypeIndex !== -1) {
					tempStatsArray[fileTypeIndex].time += 5;
				} else {
					tempStatsArray.push(
						{
							extension: `${fileExtension}`,
							time: 5
						}
					);
				};
			};
		} else {
			inactiveTimer += 5;

			if (inactiveTimer >= inactiveThreshold) {
				isInactive = true;
			};
		};
	}, 5000);

	setInterval(async () => {
		const currentDate = new Date();
		const currentDateNumber = parseInt(`${currentDate.getFullYear()}${(currentDate.getMonth() + 1).toString().padStart(2, "0")}${currentDate.getDate().toString().padStart(2, "0")}`, 10);
		const workspaceFolderName = vscode.workspace.workspaceFolders?.[0].name;
		let statsFileObj: { [key: string]: any } = {};

		try {
			statsFileObj = JSON.parse(fs.readFileSync(`${extensionPath}/data/stats.json`, "utf8"));
			
			const statsFileData = JSON.stringify(statsFileObj);
			fs.writeFileSync(`${extensionPath}/data/temp/stats.json`, statsFileData, "utf8");
		} catch (error) {
			try {
				statsFileObj = JSON.parse(fs.readFileSync(`${extensionPath}/data/temp/stats.json`, "utf8"));
			} catch (error) {
				await newProgressNotification(30000, "Statice could not read your stats file, and the temporary version is also unavailable or corrupted. Please restore a backup from your account, or contact support on GitHub if you need further assistance.", true);
			};
		};
		
		let lastMinCodingTime = 0;

		tempStatsArray.forEach(tempFileTypeObj => {
			const fileTypeIndex = statsFileObj.programmingLanguagesArray.findIndex((fileTypeObj: { extension: string; time: number; }) => fileTypeObj.extension === tempFileTypeObj.extension);
			
			if (fileTypeIndex !== -1) {
				lastMinCodingTime += tempFileTypeObj.time;

				statsFileObj.programmingLanguagesArray[fileTypeIndex].time += tempFileTypeObj.time;
			} else {
				statsFileObj.programmingLanguagesArray.push(
					{
						extension: tempFileTypeObj.extension,
						time: tempFileTypeObj.time
					}
				);
			};
		});
		tempStatsArray.length = 0;

		const dayHistoryIndex = statsFileObj.historyArray.findIndex((dayObj: { date: number; time: number; }) => dayObj.date === currentDateNumber);
		
		if (dayHistoryIndex !== -1) {
			statsFileObj.historyArray[dayHistoryIndex].time += lastMinCodingTime;
		} else {
			statsFileObj.historyArray.push(
				{
					date: currentDateNumber,
					time: lastMinCodingTime
				}
			);
		};

		if (workspaceFolderName !== undefined) {
			const projectIndex = statsFileObj.projectsArray.findIndex((projectObj: { name: string; time: number; }) => projectObj.name === workspaceFolderName);

			if (projectIndex !== -1) {
				statsFileObj.projectsArray[projectIndex].time += lastMinCodingTime;
			} else {
				statsFileObj.projectsArray.push(
					{
						name: workspaceFolderName,
						time: lastMinCodingTime
					}
				);
			};
		};

		try {
			fs.writeFileSync(`${extensionPath}/data/stats.json`, JSON.stringify(statsFileObj), "utf8");
			sessionCodingTime += lastMinCodingTime;
		} catch (error) {
			statusBarItem.tooltip = "An error occurred while updating your stats.";
			statusBarItem.backgroundColor = new vscode.ThemeColor("statusBarItem.errorBackground");

			newProgressNotification(12500, `Statice failed to update your stats due to an unexpected issue.`, true);
		};

		lastMinCodingTime = 0;

		if (sessionCodingTime === 7200) {
			newProgressNotification(12500, "You've been coding for two hours. Time to grab a coffee !");
		};
		if (sessionCodingTime === 14400) {
			newProgressNotification(12500, "Four hours of coding ! The coffee is gone, but the bugs remain...");
		};
		if (sessionCodingTime=== 21600) {
			newProgressNotification(12500, "Six hours in... Have you considered that the bug might actually be a feature ?");
		};
		if (sessionCodingTime === 28800) {
			newProgressNotification(12500, "Height hours... Maybe it's time to check if the sun still exists...");
		};
		if (sessionCodingTime === 36000) {
			newProgressNotification(12500, "Ten hours in... Even infinite loops would have stopped by now.");
		};
		if (sessionCodingTime === 43200) {
			newProgressNotification(12500, "Twelve hours straight !!! You've unlocked the \"Sleep is for the weak\" achievement !");
		};
		if (sessionCodingTime === 86400) {
			newProgressNotification(12500, "24 hours really ??? Your keyboard survived, but can you say the same about your sanity... Sleep, hydrate, and try again later ! (CTRL + S > ALT + F4)");
		};
	}, 60000);

	let dashboardPanelObj: vscode.WebviewPanel | undefined = undefined;

	context.subscriptions.push(
		vscode.commands.registerCommand("staticeOpenDashboard", async () => {
			if (dashboardPanelObj === undefined) {
				dashboardPanelObj = vscode.window.createWebviewPanel("staticeDashboardWebView", "Dashboard", vscode.ViewColumn.One, {
					enableScripts: true,
					localResourceRoots: [
						vscode.Uri.file(`${extensionPath}/libs`),
						vscode.Uri.file(`${extensionPath}/src/assets`),
						vscode.Uri.file(`${extensionPath}/src/css`),
						vscode.Uri.file(`${extensionPath}/src/js`),
						vscode.Uri.file(`${extensionPath}/src/wco`),
						vscode.Uri.file(`${extensionPath}/src/wco/schemas`)
					],
					retainContextWhenHidden: true
				});

				try {
					let htmlFileData = fs.readFileSync(`${extensionPath}/src/pages/index.html`, "utf8");
					htmlFileData = htmlFileData.replace(/href="\/src\/css\/style\.css"/, `href="${dashboardPanelObj.webview.asWebviewUri(vscode.Uri.file(`${extensionPath}/src/css/style.css`))}"`);
	
					function loadLib(lib: Lib) {
						const scriptTag = `<script src="${dashboardPanelObj?.webview.asWebviewUri(vscode.Uri.file(`${extensionPath}${lib.path}/${lib.name}-${lib.version}.${lib.extension}`))}" ${lib.defered ? "defer" : ""}></script>`;
						
						htmlFileData = htmlFileData.replace(/<libs>(.*?)<\/libs>/gs, `<libs>$1\n${scriptTag}</libs>`);
					};
	
					libsArray.forEach(libObj => {
						loadLib(libObj);
					});
					
					htmlFileData = htmlFileData.replace(/src="\/src\/js\/main\.js"/, `src="${dashboardPanelObj.webview.asWebviewUri(vscode.Uri.file(`${extensionPath}/src/js/main.js`))}"`);
					htmlFileData = htmlFileData.replace(/data-current-theme="[^"]*"/, `data-current-theme="${vscode.workspace.getConfiguration().get<string>("statice.theme")?.toLowerCase()}"`);
					
					dashboardPanelObj.webview.html = htmlFileData;
				} catch (error) {
					await newActionNotification("error", "An error occurred while loading the Statice ressources.", [getHelpActionBtnObj]);
				};

				dashboardPanelObj.onDidDispose(() => {
					dashboardPanelObj = undefined;
				}, null, context.subscriptions);
			} else {
				dashboardPanelObj.reveal(vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : undefined);
			};

			dashboardPanelObj.webview.onDidReceiveMessage(async messageObj => {
				if (messageObj.id === "getAllSettings") {
					await dashboardPanelObj?.webview.postMessage(
						{
							id: "getAllSettings",
							data: {
								settingsObj: vscode.workspace.getConfiguration("statice")
							}
						}
					);
				};

				if (messageObj.id === "getSetting") {
					await dashboardPanelObj?.webview.postMessage(
						{
							id: "getSetting",
							data: {
								settingName: messageObj.data.settingName,
								settingValue: vscode.workspace.getConfiguration().get(`statice.${messageObj.data.settingName}`)
							}
						}
					);
				};

				if (messageObj.id === "setSetting") {
					vscode.workspace.getConfiguration().update(`statice.${messageObj.data.settingName}`, messageObj.data.settingValue, vscode.ConfigurationTarget.Global);
					
					await dashboardPanelObj?.webview.postMessage(
						{
							id: "setSetting",
							data: {
								settingName: messageObj.data.settingName,
								settingValue: messageObj.data.settingValue
							}
						}
					);
				};
				
				if (messageObj.id === "loadColorVariables") {
					colorVariablesObj = messageObj.data.colorVariablesObj;
				};

				if (messageObj.id === "genWcoUrls") {
					try {
						const wcoPath = `${extensionPath}${messageObj.data.wcoPath}`;
						const schemasPath = `${extensionPath}${messageObj.data.schemasPath}`;
	
						const wcoArray = fs.readdirSync(wcoPath).filter(fileName => fileName.endsWith(".wco"));
						const schemasArray = fs.readdirSync(schemasPath).filter(fileName => fileName.endsWith(".json"));
	
						let urlsObj: {
							wco: { [key: string]: string },
							schemas: { [key: string]: string }
						} = {
							wco: {},
							schemas: {}
						};
	
						wcoArray.forEach(wcoFileName => {
							const wcoName = wcoFileName.split(".")[0];
	
							urlsObj.wco[wcoName] = dashboardPanelObj?.webview.asWebviewUri(vscode.Uri.file(`${wcoPath}/${wcoName}.wco`)).toString() || "";
						});
	
						schemasArray.forEach(schemaFileName => {
							const schemaName = schemaFileName.split(".")[0];
	
							urlsObj.schemas[schemaName] = dashboardPanelObj?.webview.asWebviewUri(vscode.Uri.file(`${schemasPath}/${schemaName}.json`)).toString() || "";
						});
	
						await dashboardPanelObj?.webview.postMessage(
							{
								id: "genWcoUrls",
								data: urlsObj
							}
						);
					} catch (error) {
						await newActionNotification("error", "An error occurred while loading the Statice ressources.", [getHelpActionBtnObj]);
					};
				};

				if (messageObj.id === "fetchStatsData") {
					let statsFileObj: { [key: string]: any } = {};

					try {
						statsFileObj = JSON.parse(fs.readFileSync(`${extensionPath}/data/stats.json`, "utf8"));
						const statsFileData = JSON.stringify(statsFileObj);

						fs.writeFileSync(`${extensionPath}/data/temp/stats.json`, statsFileData, "utf8");
					} catch (error) {
						try {
							statsFileObj = JSON.parse(fs.readFileSync(`${extensionPath}/data/temp/stats.json`, "utf8"));
						} catch (error) {
							await newProgressNotification(30000, "Statice could not read your stats file, and the temporary version is also unavailable or corrupted. Please restore a backup from your account, or contact support on GitHub if you need further assistance.", true);
						};
					};
					
					const date = new Date(messageObj.data.date);
					let dateNumber = parseInt(`${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, "0")}${date.getDate().toString().padStart(2, "0")}`, 10);

					let responseDataObj: {
						totalTime: number,
						todayTime: number,
						last30DaysStats: {},
						fullWeeks: number,
						topProgrammingLanguagesArray: any[],
						topProjectsArray: any[],
						weekArray: any[],
						chartConfig: {}
					} = {
						totalTime: 0,
						todayTime: 0,
						last30DaysStats: {},
						fullWeeks: 0,
						topProgrammingLanguagesArray: [],
						topProjectsArray: [],
						weekArray: [],
						chartConfig: {}
					};

					responseDataObj.totalTime = statsFileObj.historyArray.reduce((sum: number, dayObj: { date: number; time: number; }) => sum + dayObj.time, 0);
					
					const currentDate = new Date();
					const currentDateNumber = parseInt(`${currentDate.getFullYear()}${(currentDate.getMonth() + 1).toString().padStart(2, "0")}${currentDate.getDate().toString().padStart(2, "0")}`, 10);

					const todayIndex = statsFileObj.historyArray.findIndex((dayObj: { date: number; time: number; }) => dayObj.date === currentDateNumber);

					if (todayIndex !== -1) {
						responseDataObj.todayTime = statsFileObj.historyArray[todayIndex].time;
					} else {
						responseDataObj.todayTime = 0;
					};

					const thirtyDaysAgoDate = new Date();
					thirtyDaysAgoDate.setDate(currentDate.getDate() - 30);

					const thirtyDaysAgoDateNumber = parseInt(`${thirtyDaysAgoDate.getFullYear()}${(thirtyDaysAgoDate.getMonth() + 1).toString().padStart(2, "0")}${thirtyDaysAgoDate.getDate().toString().padStart(2, "0")}`, 10);
				
					const last30DaysArray = statsFileObj.historyArray.filter((dayObj: { date: number, time: number }) => {
						return dayObj.date >= thirtyDaysAgoDateNumber && dayObj.date <= currentDateNumber;
					});

					responseDataObj.last30DaysStats = {
						time: last30DaysArray.reduce((sum: number, dayObj: { date: number, time: number }) => sum + dayObj.time, 0),
						numberOfActiveDays: last30DaysArray.filter((dayObj: { date: number, time: number }) => dayObj.time > 0).length
					};

					const historySet = new Set(statsFileObj.historyArray.map((dayObj: { date: number, time: number }) => dayObj.date));

    				const firstYearDayDate = new Date(currentDate.getFullYear(), 0, 1);

					const firstYearWeekDate = new Date(firstYearDayDate);
					firstYearWeekDate.setDate(firstYearWeekDate.getDate() - (firstYearWeekDate.getDay() + 6) % 7);

					let fullWeeks = 0;
    				let currentWeekStart = new Date(firstYearWeekDate);

					while (currentWeekStart <= currentDate) {
						let allDaysPresent = true;

						for (let i = 0; i < 7; i += 1) {
							const dayDate = new Date(currentWeekStart);
							dayDate.setDate(currentWeekStart.getDate() + i);

							const dayDateNumber = parseInt(`${dayDate.getFullYear()}${(dayDate.getMonth() + 1).toString().padStart(2, "0")}${dayDate.getDate().toString().padStart(2, "0")}`, 10);

							if (historySet.has(dayDateNumber) !== true) {
								allDaysPresent = false;
								break;
							};
						};

						if (allDaysPresent === true) {
							fullWeeks += 1;
						};

						currentWeekStart.setDate(currentWeekStart.getDate() + 7);
					};

					responseDataObj.fullWeeks = fullWeeks;

					responseDataObj.topProgrammingLanguagesArray = statsFileObj.programmingLanguagesArray.sort((x: { time: number }, y: { time: number }) => y.time - x.time).slice(0, 5);
					responseDataObj.topProgrammingLanguagesArray.push(
						{
							extension: "Other languages",
							time: responseDataObj.totalTime - responseDataObj.topProgrammingLanguagesArray.reduce((sum: number, fileTypeObj: { extension: string; time: number; }) => sum + fileTypeObj.time, 0)
						}
					);

					responseDataObj.topProjectsArray = statsFileObj.projectsArray.sort((x: { time: number }, y: { time: number }) => y.time - x.time).slice(0, 5);
					responseDataObj.topProjectsArray.push(
						{
							name: "Other projects",
							time: responseDataObj.totalTime - responseDataObj.topProjectsArray.reduce((sum: number, projectObj: { name: string; time: number; }) => sum + projectObj.time, 0)
						}
					);

					const dayOfWeek = date.getDay();
					const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
					const mondayDate = new Date(date);
					mondayDate.setDate(date.getDate() + mondayOffset);

					for (let i = 0; i < 7; i += 1) {
						const weekDay = new Date(mondayDate);
						weekDay.setDate(mondayDate.getDate() + i);

						dateNumber = parseInt(`${weekDay.getFullYear()}${(weekDay.getMonth() + 1).toString().padStart(2, "0")}${weekDay.getDate().toString().padStart(2, "0")}`, 10);
						
						const dayHistoryIndex = statsFileObj.historyArray.findIndex((dayObj: { date: number; time: number; }) => dayObj.date === dateNumber);
						
						if (dayHistoryIndex !== -1) {
							responseDataObj.weekArray.push(statsFileObj.historyArray[dayHistoryIndex]);
						} else {
							responseDataObj.weekArray.push(
								{
									date: dateNumber,
									time: 0
								}
							);
						};
					};

					function chartGridScale(weekArray: any[]) {
						let maxTime = weekArray.reduce((max: number, dayObj: { date: string, time: number }) => {
							return Math.max(max, dayObj.time);
						}, 0);

						maxTime /= 3600;

						if (maxTime <= 7) {
							return {
								max: 8,
								stepSize: 1
							};
						} else if (maxTime <= 15) {
							return {
								max: 16,
								stepSize: 2
							};
						} else {
							return {
								max: 24,
								stepSize: 3
							};
						};
					};

					const labelsArray = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

					const chartGridScaleObj = chartGridScale(responseDataObj.weekArray);

					responseDataObj.chartConfig = {
						type: "line",
						data: {
							labels: labelsArray,
							datasets: [
								{
									backgroundColor: "rgba(0, 0, 0, 0.1)",
									borderCapStyle: "butt",
									borderColor: `rgba(${colorVariablesObj["--greenLevelColor4"]}, 1)`,
									borderDash: [],
									borderDashOffset: 0.0,
									borderJoinStyle: "miter",
									borderWidth: 3,
									clip: undefined,
									cubicInterpolationMode: "default",
									data: [
										{
											x: labelsArray[0],
											y: responseDataObj.weekArray[0].time / 3600
										},
										{
											x: labelsArray[1],
											y: responseDataObj.weekArray[1].time / 3600
										},
										{
											x: labelsArray[2],
											y: responseDataObj.weekArray[2].time / 3600
										},
										{
											x: labelsArray[3],
											y: responseDataObj.weekArray[3].time / 3600
										},
										{
											x: labelsArray[4],
											y: responseDataObj.weekArray[4].time / 3600
										},
										{
											x: labelsArray[5],
											y: responseDataObj.weekArray[5].time / 3600
										},
										{
											x: labelsArray[6],
											y: responseDataObj.weekArray[6].time / 3600
										}
									],
									drawActiveElementsOnTop: true,
									fill: true,
									hoverBorderCapStyle: undefined,
									hoverBorderColor: undefined,
									hoverBorderDash: undefined,
									hoverBorderDashOffset: undefined,
									hoverBorderJoinStyle: undefined,
									hoverBorderWidth: undefined,
									indexAxis: "x",
									label: "",
									order: 0,
									pointBackgroundColor: `rgba(${colorVariablesObj["--greenLevelColor4"]}, 1)`,
									pointBorderColor: `rgba(${colorVariablesObj["--greenLevelColor4"]}, 1)`,
									pointBorderWidth: 1.5,
									pointHitRadius: 1,
									pointHoverBackgroundColor: undefined,
									pointHoverBorderColor: undefined,
									pointHoverBorderWidth: 1,
									pointHoverRadius: 8,
									pointRadius: 5,
									pointRotation: 0,
									pointStyle: "circle",
									segment: undefined,
									showLine: true,
									spanGaps: undefined,
									stack: "line",
									stepped: false,
									tension: 0.25,
									xAxisID: "xAxis",
									yAxisID: "yAxis"
								}
							]
						},
						options: {
							animations: {},
							aspectRatio: 1 / 2,
							events: ["mousemove"],
							layout: {
								autoPadding: true,
								padding: 10
							},
							maintainAspectRatio: false,
							onResize: null,
							plugins: {
								legend: {
									display: false
								},
								tooltip: {
									enabled: true,
									external: null,
									mode: "point",
									intersect: false,
									position: "average",
									backgroundColor: `rgba(${colorVariablesObj["--headerBackgroundColor"]}, 1)`,
									titleColor: `rgba(${colorVariablesObj["--textColor2"]}, 1)`,
									titleAlign: "left",
									titleSpacing: 2,
									titleMarginBottom: 6,
									bodyColor: `rgba(${colorVariablesObj["--textColor2"]}, 1)`,
									bodyAlign: "left",
									bodySpacing: 2,
									footerColor: `rgba(${colorVariablesObj["--textColor2"]}, 1)`,
									footerAlign: "left",
									footerSpacing: 2,
									footerMarginTop: 6,
									padding: 6,
									caretPadding: 2,
									caretSize: 5,
									cornerRadius: 6,
									multiKeyBackground: `rgba(${colorVariablesObj["--textColor2"]}, 1)`,
									displayColors: true,
									boxPadding: 1,
									usePointStyle: true,
									borderColor: "rgba(0, 0, 0, 0)",
									borderWidth: 0,
									xAlign: undefined,
									yAlign: undefined,
								}
							},
							resizeDelay: 0,
							responsive: false,
							scales: {
								xAxis: {
									grid: {
										circular: false,
										color: [`rgba(${colorVariablesObj["--borderColor"]}, 1)`, "rgba(0, 0, 0, 0)", "rgba(0, 0, 0, 0)", "rgba(0, 0, 0, 0)", "rgba(0, 0, 0, 0)", "rgba(0, 0, 0, 0)", `rgba(${colorVariablesObj["--borderColor"]}, 1)`],
										display: true,
										drawOnChartArea: true,
										drawTicks: false,
										lineWidth: 1,
										offset: false,
										z: 0
									},
									ticks: {
										color: `rgba(${colorVariablesObj["--textColor2"]}, 1)`,
										padding: 10
									}
								},
								yAxis: {
									grid: {
										circular: false,
										color: `rgba(${colorVariablesObj["--borderColor"]}, 1)`,
										display: true,
										drawOnChartArea: true,
										drawTicks: true,
										lineWidth: 1,
										offset: false,
										z: 0
									},
									max: chartGridScaleObj.max,
									min: 0,
									stepSize: chartGridScaleObj.stepSize,
									ticks: {
										color: `rgba(${colorVariablesObj["--textColor2"]}, 1)`,
										padding: 10
									}
								}
							},
							title: {
								display: false
							}
						},
						plugins: [],
						customData: {
							colorVariablesObj: colorVariablesObj
						}
					};
					
					await dashboardPanelObj?.webview.postMessage(
						{
							id: "fetchStatsData",
							data: responseDataObj
						}
					);
				};

				if (messageObj.id === "importStats") {
					const statsFileDialog = await vscode.window.showOpenDialog(
						{
							canSelectMany: false,
							openLabel: "Import stats",
							filters: {
								"Statice stats file": ["statice"],
							}
						}
					);

					if (statsFileDialog !== undefined) {
						try {
							const statsFileDataBuffer = Buffer.from(await vscode.workspace.fs.readFile(statsFileDialog[0]));
							const statsFileData = statsFileDataBuffer.toString("utf8");
							const statsFileObj = JSON.parse(statsFileData);

							fs.writeFileSync(`${extensionPath}/data/stats.json`, JSON.stringify(statsFileObj), "utf8");

							await dashboardPanelObj?.webview.postMessage(
								{
									id: "importStatsStatus",
									data: {
										type: "info",
										message: "Stats data has been successfully imported."
									}
								}
							);
						} catch (error) {
							await dashboardPanelObj?.webview.postMessage(
								{
									id: "importStatsStatus",
									data: {
										type: "error",
										message: "An error has occurred while importing the data."
									}
								}
							);
						};
					} else {
						await dashboardPanelObj?.webview.postMessage(
							{
								id: "importStatsStatus",
								data: {
									type: "error",
									message: "No stats file selected, stats importing has been cancelled."
								}
							}
						);
					};
				};

				if (messageObj.id === "exportStats") {
					const statsFileDialog = await vscode.window.showSaveDialog(
						{
							defaultUri: vscode.Uri.file("stats"),
							saveLabel: "Export stats",
							filters: {
								"Statice stats file": ["statice"],
							}
						}
					);

					if (statsFileDialog !== undefined) {
						try {
							const statsFileData = fs.readFileSync(`${extensionPath}/data/stats.json`, "utf8");
							const statsFileDataBuffer = Buffer.from(statsFileData, "utf8");

							await vscode.workspace.fs.writeFile(statsFileDialog, statsFileDataBuffer);
	
							await dashboardPanelObj?.webview.postMessage(
								{
									id: "exportStatsStatus",
									data: {
										type: "info",
										message: "Stats data has been successfully exported."
									}
								}
							);
						} catch (error) {
							await dashboardPanelObj?.webview.postMessage(
								{
									id: "exportStatsStatus",
									data: {
										type: "error",
										message: "An error has occurred while exporting the data."
									}
								}
							);
						};
					} else {
						await dashboardPanelObj?.webview.postMessage(
							{
								id: "exportStatsStatus",
								data: {
									type: "error",
									message: "No file was selected, stats export has been cancelled."
								}
							}
						);
					};
				};

				if (messageObj.id === "fetchBackups") {
					try {
						const backupsFileNameArray = fs.readdirSync(`${extensionPath}/data/backups`).sort((x: string, y: string) => Number(y.split("_")[0]) - Number(x.split("_")[0]));

						const backupsArray: {
							timestamp: string;
							sizeb: string;
						}[] = [];

						backupsFileNameArray.forEach(fileName => {
							const [timestamp, fileSize] = fileName.split(".")[0].split("_");

							backupsArray.push(
								{
									timestamp: timestamp,
									sizeb: fileSize
								}
							);
						});

						await dashboardPanelObj?.webview.postMessage(
							{
								id: "fetchBackups",
								data: {
									backupsArray: backupsArray
								}
							}
						);
					} catch (error) {
						await dashboardPanelObj?.webview.postMessage(
							{
								id: "fetchBackups",
								data: {
									backupsArray: []
								}
							}
						);
					};
				};

				if (messageObj.id === "restoreBackup") {
					try {
						const confirmationDaliog = await vscode.window.showWarningMessage("Are you sure you want to restore this backup ? This action will permanently replace your current statistics with those from the selected backup.", { modal: true }, "Yes", "No");
						
						if (confirmationDaliog === "Yes") {
							const buffer = fs.readFileSync(`${extensionPath}/data/backups/${messageObj.data.backupName}`);
							const unzippedFileData = zlib.gunzipSync(buffer).toString();
							
							fs.writeFileSync(`${extensionPath}/data/stats.json`, unzippedFileData, "utf8");
						
							await dashboardPanelObj?.webview.postMessage(
								{
									id: "restoreBackupStatus",
									data: {
										type: "info",
										message: "Backup has been successfully restored."
									}
								}
							);
						} else {
							await dashboardPanelObj?.webview.postMessage(
								{
									id: "restoreBackupStatus",
									data: {
										type: "error",
										message: "Backup restoration has been cancelled."
									}
								}
							);
						};
					} catch (error) {
						await dashboardPanelObj?.webview.postMessage(
							{
								id: "restoreBackupStatus",
								data: {
									type: "error",
									message: "Backup restoration failed due to an unexpected error."
								}
							}
						);
					};
				};

				if (messageObj.id === "resetStats") {
					const dataObj = {
						extensionVersion: extensionVersion,
						programmingLanguagesArray: [],
						projectsArray: [],
						historyArray: []
					};

					try {
						const confirmationDaliog = await vscode.window.showWarningMessage("Are you sure you want to reset all your Statice stats ?", { modal: true }, "Yes", "No");

						if (confirmationDaliog === "Yes") {
							fs.writeFileSync(`${extensionPath}/data/stats.json`, JSON.stringify(dataObj), "utf8");

							await dashboardPanelObj?.webview.postMessage(
								{
									id: "resetStatsStatus",
									data: {
										type: "info",
										message: "Stats data has been successfully reset."
									}
								}
							);
						} else {
							await dashboardPanelObj?.webview.postMessage(
								{
									id: "resetStatsStatus",
									data: {
										type: "error",
										message: "Stats reset has been cancelled."
									}
								}
							);
						};
					} catch (error) {
						await dashboardPanelObj?.webview.postMessage(
							{
								id: "resetStatsStatus",
								data: {
									type: "error",
									message: "An error have occurred when resetting the data."
								}
							}
						);
					};
				};
			});
		}),
		vscode.commands.registerCommand("staticeOpenSettings", () => {
			vscode.commands.executeCommand("workbench.action.openSettings", "@ext:devpotatoes.statice");
    	}),
		vscode.commands.registerCommand("staticeOpenDocumentation", () => {
			vscode.commands.executeCommand("markdown.showPreview", vscode.Uri.file(`${extensionPath}/README.md`));
    	})
	);
};

export function deactivate() {};