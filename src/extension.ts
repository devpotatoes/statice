import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

function checkStatsFile(context: any) {
    const extensionPath = context.extensionPath;
	if (fs.existsSync(`${extensionPath}/data/stats.json`) !== true) {
		const folderPath = path.join(extensionPath, "data");
		try {
			fs.mkdirSync(folderPath);
		} catch (error) {
			vscode.window.showErrorMessage("There seems to have been an error when launching the extension.", "OK");
		};
		const jsonFilePath = path.join(`${extensionPath}/data`, "stats.json");
		const JSONData = { totalTime:0, codeTypesList:[], projectsList: [], history:[] };
		try {
			fs.writeFileSync(jsonFilePath, JSON.stringify(JSONData, null, 4), "utf8");
		} catch (error) {
			vscode.window.showErrorMessage("There seems to have been an error when launching the extension.", "OK");
		};
    };
};

async function selfCancelingNotification(timeout: number, message: string, forced: boolean) {
	if (forced === true || vscode.workspace.getConfiguration().get("statice.notifications") === true) {
		await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, cancellable: false }, async progress => {
			progress.report({ increment: 100, message: message });
			await new Promise(resolve => setTimeout(resolve, timeout));
		});
	};
};

export function activate(context: vscode.ExtensionContext) {
	checkStatsFile(context);
	let statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
	statusBarItem.text = "$(info) Statice";
    statusBarItem.tooltip = "Statice Enable";
	statusBarItem.show();

	let codingTime = 0;

	interface FileType {
		type: string;
		time: number;
	};
	let fileTypeArray: FileType[] = [];

	setInterval(() => {
		const editor = vscode.window.activeTextEditor;
		if (editor) {
			const fileUri = editor.document.uri;
			const fileType = fileUri.fsPath.split(".").pop();
			const typeObject = fileTypeArray.find(fileTypeObject => fileTypeObject.type === fileType);
			if (!typeObject) {
				fileTypeArray.push({
					type: `${fileType}`,
					time: 0
				});
			} else {
				fileTypeArray.forEach(fileTypeObject => {
					if (fileTypeObject.type === fileType) {
						fileTypeObject.time += 2;
					};
				});
			};
		};
	}, 2000);

	let timeInterval = setInterval(async () => {
		codingTime++;
		const date = new Date();
		const currentDate = Number(`${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, "0")}${date.getDate().toString().padStart(2, "0")}`);
		const workspaceFolder = vscode.workspace.workspaceFolders;
		const statsFileBuffer = await vscode.workspace.fs.readFile(vscode.Uri.file(path.join(context.extensionPath, "data/stats.json")));
		const statsFile = JSON.parse(statsFileBuffer.toString());
		statsFile.totalTime++;
		let currentDateHistoryIndex;
		if (statsFile.history.length > 0) {
			currentDateHistoryIndex = statsFile.history.findIndex((date: { date: number; time: number; }) => date.date === currentDate);
		} else {
			currentDateHistoryIndex = -1;
		};
		if (currentDateHistoryIndex === -1) {
			statsFile.history.push({ date: currentDate, time: 1 });
		} else {
			statsFile.history[currentDateHistoryIndex].time++;
		};
		fileTypeArray.forEach(fileTypeObject => {
			let codeTypeIndex;
			if (statsFile.codeTypesList.length > 0) {
				codeTypeIndex = statsFile.codeTypesList.findIndex((type: { type: string; time: number; }) => type.type === fileTypeObject.type);
			} else {
				codeTypeIndex = -1;
			};
			if (codeTypeIndex === -1) {
				statsFile.codeTypesList.push({ type: fileTypeObject.type, time: fileTypeObject.time });
			} else {
				statsFile.codeTypesList[codeTypeIndex].time += fileTypeObject.time;
			};
		});
		fileTypeArray = [];
		if (workspaceFolder !== undefined) {
			let projectIndex;
			if (statsFile.projectsList.length > 0) {
				projectIndex = statsFile.projectsList.findIndex((projectObject: { name: string; time: number; }) => projectObject.name === workspaceFolder[0].name);
			} else {
				projectIndex = -1;
			};
			if (projectIndex === -1) {
				statsFile.projectsList.push({
					name: workspaceFolder[0].name,
					time: 1
				});
			} else {
				statsFile.projectsList[projectIndex].time++;
			};
		};
		try {
			await vscode.workspace.fs.writeFile(vscode.Uri.file(path.join(context.extensionPath, "data/stats.json")), Buffer.from(JSON.stringify(statsFile)))
			.then(() => {
				const hours = Math.floor(codingTime / 60);
				const minutes = codingTime % 60;
				if (hours === 0) {
					statusBarItem.tooltip = `Statice Enable ${minutes}min`;
				} else {
					statusBarItem.tooltip = `Statice Enable ${hours}h ${minutes}min`;
				};
			});
		} catch (error) {
			statusBarItem.tooltip = "Statice Disable";
			statusBarItem.backgroundColor = new vscode.ThemeColor("statusBarItem.errorBackground");
			await selfCancelingNotification(7500, "Oops, while updating your stats Statice encountered a problem.", false);
		};
		if (codingTime === 120) {
			await selfCancelingNotification(10000, "You've been coding for 2 hours, why not take a coffee break ?", false);
		};
		if (codingTime === 720) {
			await selfCancelingNotification(10000, "You've been coding for 12 hours straight. Get some sleep !", false);
		};
	}, 60000);

	let dashboardPanel: vscode.WebviewPanel | undefined = undefined;
	context.subscriptions.push(
		vscode.commands.registerCommand("staticeOpenDashboard", async () => {
			if (dashboardPanel) {
				const column = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : undefined;
				dashboardPanel.reveal(column);
			} else {
				dashboardPanel = vscode.window.createWebviewPanel("staticeDashboardWebView", "Dashboard", vscode.ViewColumn.One, { enableScripts: true, retainContextWhenHidden: true });
				dashboardPanel.webview.html = dashboardHTML();
				dashboardPanel.onDidDispose(() => {
					dashboardPanel = undefined;
				}, null, context.subscriptions);
			};
			dashboardPanel.webview.onDidReceiveMessage(async message => {
				if (message.id === "loadCSSVariable") {
					let themeValue = vscode.workspace.getConfiguration().get("statice.theme");
					if (themeValue === "Auto") {
						const VSCodeTheme = vscode.window.activeColorTheme.kind;
						if (VSCodeTheme === 1 || VSCodeTheme === 4) {
							themeValue = "Light";
						} else if (VSCodeTheme === 2 || VSCodeTheme === 3) {
							themeValue = "Dark";
						};
					};
					await dashboardPanel?.webview.postMessage({ id: "loadCSSVariable", data: themeValue });
				};
				if (message.id === "loadChart") {
					const inputDateValue = message.data;
					const date = new Date(inputDateValue);
					const dayOfWeek = date.getDay();
					const mondayDate = new Date(date);
					mondayDate.setDate(date.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1));
					const sundayDate = new Date(mondayDate);
					sundayDate.setDate(mondayDate.getDate() + 6);
					const weekDates = {
						monday: mondayDate.toISOString().split("T")[0].replace(/-/g, ""),
						tuesday: new Date(mondayDate.getFullYear(), mondayDate.getMonth(), mondayDate.getDate() + 2).toISOString().split("T")[0].replace(/-/g, ""),
						wednesday: new Date(mondayDate.getFullYear(), mondayDate.getMonth(), mondayDate.getDate() + 3).toISOString().split("T")[0].replace(/-/g, ""),
						thursday: new Date(mondayDate.getFullYear(), mondayDate.getMonth(), mondayDate.getDate() + 4).toISOString().split("T")[0].replace(/-/g, ""),
						friday: new Date(mondayDate.getFullYear(), mondayDate.getMonth(), mondayDate.getDate() + 5).toISOString().split("T")[0].replace(/-/g, ""),
						saturday: new Date(mondayDate.getFullYear(), mondayDate.getMonth(), mondayDate.getDate() + 6).toISOString().split("T")[0].replace(/-/g, ""),
						sunday: sundayDate.toISOString().split("T")[0].replace(/-/g, "")
					};
					const statsFileBuffer = await vscode.workspace.fs.readFile(vscode.Uri.file(path.join(context.extensionPath, "data/stats.json")));
					const statsFile = JSON.parse(statsFileBuffer.toString());
					const codeTime: number[] = [];
					for (const day of Object.keys(weekDates) as (keyof typeof weekDates)[]) {
						let dateHistoryIndex;
						if (statsFile.history.length > 0) {
							dateHistoryIndex = statsFile.history.findIndex((date: { date: number; time: number; }) => date.date === Number(weekDates[day]));
						} else {
							dateHistoryIndex = -1;
						};
						if (dateHistoryIndex === -1) {
							codeTime.push(0);
						} else {
							codeTime.push(statsFile.history[dateHistoryIndex].time / 60);
						};
					};
					const gridScale = () => {
						const maxCodeTimeValue = Math.max(...codeTime);
						if (maxCodeTimeValue <= 8) {
							return { max: 8, suggestedMax: 8, stepSize: 1 };
						} else if (maxCodeTimeValue <= 16) {
							return { max: 16, suggestedMax: 16, stepSize: 2 };
						} else if (maxCodeTimeValue <= 24) {
							return { max: 24, suggestedMax: 24, stepSize: 5 };
						};
					};
					const colors = {
						green: { default: "rgba(149, 213, 178, 1)", half: "rgba(116, 198, 157, 0.5)", quarter: "rgba(116, 198, 157, 0.25)", zero: "rgba(0, 0, 0, 0)" },
						darkGrey : "rgba(80, 100, 120, 0.25)",
						white: "rgba(255, 255, 255, 1)"
					};
					const labels = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
					const options = {
						type: "line",
						data: {
							labels: labels,
							datasets: [
								{
									backgroundColor: "",
									borderCapStyle: "butt",
									borderColor: colors.green.default,
									borderDash: [],
									borderDashOffset: 0,
									borderJoinStyle: "miter",
									borderWidth: 3,
									clip: undefined,
									cubicInterpolationMode: "default",
									data: codeTime,
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
									pointBackgroundColor: colors.green.default,
									pointBorderColor: colors.darkGrey,
									pointBorderWidth: 2,
									pointHitRadius: 1,
									pointHoverBackgroundColor: undefined,
									pointHoverBorderColor: undefined,
									pointHoverBorderWidth: 1,
									pointHoverRadius: 4,
									pointRadius: 4,
									pointRotation: 0,
									pointStyle: "circle",
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
							events: ["mousemove", "mouseout", "click", "touchstart", "touchmove"],
							layout: {
								autoPadding: true,
								padding: 10
							},
							maintainAspectRatio: true,
							onResize: null,
							plugins: {
								legend: { display: false },
								tooltip: {
									enabled: true,
									external: null,
									mode: "point",
									intersect: false,
									position: "average",
									backgroundColor: "rgba(0, 0, 0, 0.8)",
									titleColor: colors.white,
									titleAlign: "left",
									titleSpacing: 2,
									titleMarginBottom: 6,
									bodyColor: colors.white,
									bodyAlign: "left",
									bodySpacing: 2,
									footerColor: colors.white,
									footerAlign: "left",
									footerSpacing: 2,
									footerMarginTop: 6,
									padding: 6,
									caretPadding: 2,
									caretSize: 5,
									cornerRadius: 6,
									multiKeyBackground: colors.white,
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
							responsive: true,
							title: { display: false },
							scales: {
								xAxis: {
									grid: { circular: false, color: [colors.darkGrey, "rgba(0, 0, 0, 0)", "rgba(0, 0, 0, 0)", "rgba(0, 0, 0, 0)", "rgba(0, 0, 0, 0)", "rgba(0, 0, 0, 0)", "rgba(0, 0, 0, 0)"], display: true, drawOnChartArea: true, drawTicks: true, lineWidth: 1, offset: false, z: -1 }
								},
								yAxis: {
									beginAtZero: true,
									grid: { circular: false, color: colors.darkGrey, display: true, drawOnChartArea: true, drawTicks: true, lineWidth: 1, offset: false, z: -1 },
									max: gridScale()?.max,
									stepSize: gridScale()?.suggestedMax,
									suggestedMax: gridScale()?.suggestedMax,
									suggestedMin: 0,
									title: { display: false, align: "center", text: "Time in hours", color: colors.darkGrey, padding: 0 },
									ticks: { padding: 10 }
								}
							}
						},
						plugins: []
					};
					await dashboardPanel?.webview.postMessage({ id: "loadChart", data: { options: options, colors: colors, dates: { mondayDate: mondayDate, sundayDate: sundayDate, weekDates: weekDates } } });
				};
				if (message.id === "updateChartSVG") {
					const statsFileBuffer = await vscode.workspace.fs.readFile(vscode.Uri.file(path.join(context.extensionPath, "data/stats.json")));
					const statsFile = JSON.parse(statsFileBuffer.toString());
					const currentDate = new Date();
					const weekDates = {
						today: currentDate.toISOString().split("T")[0].replace(/-/g, ""),
						yesterday: new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() - 0).toISOString().split("T")[0].replace(/-/g, ""),
						twoDaysAgo: new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() - 1).toISOString().split("T")[0].replace(/-/g, ""),
						threeDaysAgo: new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() - 2).toISOString().split("T")[0].replace(/-/g, ""),
						fourDaysAgo: new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() - 3).toISOString().split("T")[0].replace(/-/g, ""),
						fiveDaysAgo: new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() - 4).toISOString().split("T")[0].replace(/-/g, ""),
						sixDaysAgo: new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() - 5).toISOString().split("T")[0].replace(/-/g, "")
					};
					const recentDaysCodeTime: number[] = [];
					for (const day of Object.keys(weekDates) as (keyof typeof weekDates)[]) {
						let dateHistoryIndex;
						if (statsFile.history.length > 0) {
							dateHistoryIndex = statsFile.history.findIndex((date: { date: number; time: number; }) => date.date === Number(weekDates[day]));
						} else {
							dateHistoryIndex = -1;
						}
						if (dateHistoryIndex === -1) {
							recentDaysCodeTime.push(0);
						} else {
							recentDaysCodeTime.push(statsFile.history[dateHistoryIndex].time);
						};
					};
					const recentDaysCodeTimeSum = recentDaysCodeTime.reduce((total: number, time: number) => total + time, 0);
					const averageRecentDaysCodeTime = recentDaysCodeTime.reduce((total: number, time: number) => total + time, 0) / recentDaysCodeTime.length;
					const dayTimeArray = statsFile.history.map((date: { name: string; time: number; }) => date.time);
					const averageDayTime = dayTimeArray.reduce((total: number, time: number) => total + time, 0) / dayTimeArray.length;
					const totalRateOfIncrease = (recentDaysCodeTimeSum / (statsFile.totalTime - recentDaysCodeTimeSum)) * 100;
					const dayRateOfIncrease = ((averageRecentDaysCodeTime - averageDayTime) / averageDayTime) * 100;
					await dashboardPanel?.webview.postMessage({ id: "updateChartSVG", data: { total: totalRateOfIncrease, day: dayRateOfIncrease } });
				};
				if (message.id === "updateCodeTimeModule") {
					const inputDateValue = new Date(message.data);
					const statsFileBuffer = await vscode.workspace.fs.readFile(vscode.Uri.file(path.join(context.extensionPath, "data/stats.json")));
					const statsFile = JSON.parse(statsFileBuffer.toString());
					let dateHistoryIndex;
					if (statsFile.history.length > 0) {
						dateHistoryIndex = statsFile.history.findIndex((date: { date: number; time: number; }) => date.date === Number(`${inputDateValue.getFullYear()}${(inputDateValue.getMonth() + 1).toString().padStart(2, "0")}${inputDateValue.getDate().toString().padStart(2, "0")}`));
					} else {
						dateHistoryIndex = -1;
					}
					if (dateHistoryIndex === -1) {
						await dashboardPanel?.webview.postMessage({ id: "updateCodeTimeModule", data: { total: `${Math.floor(statsFile.totalTime / 60)}h ${statsFile.totalTime % 60}min`, day: "0min" } });
					} else {
						const hours = Math.floor(statsFile.history[dateHistoryIndex].time / 60);
						if (hours === 0) {
							await dashboardPanel?.webview.postMessage({ id: "updateCodeTimeModule", data: { total: `${Math.floor(statsFile.totalTime / 60)}h ${statsFile.totalTime % 60}min`, day: `${statsFile.history[dateHistoryIndex].time % 60}min` } });
						} else {
							await dashboardPanel?.webview.postMessage({ id: "updateCodeTimeModule", data: { total: `${Math.floor(statsFile.totalTime / 60)}h ${statsFile.totalTime % 60}min`, day: `${hours}h ${statsFile.history[dateHistoryIndex].time % 60}min` } });
						};
					};
				};
				if (message.id === "updateStreakModule") {
					const statsFileBuffer = await vscode.workspace.fs.readFile(vscode.Uri.file(path.join(context.extensionPath, "data/stats.json")));
					const statsFile = JSON.parse(statsFileBuffer.toString());
					const currentDate = new Date();
					const getISODate = (date: Date) => date.toISOString().split("T")[0].replace(/-/g, "");
					let streak = 0;
					let weekLoop = 0;
					for (let i = 0; i <= statsFile.history.length - 7; i++) {
						let isWeekComplete = true;
						const mondayDate = new Date(currentDate);
						mondayDate.setDate((currentDate.getDate() - currentDate.getDay() + (currentDate.getDay() === 0 ? -6 : 1)) - 7 * weekLoop);
						const sundayDate = new Date(mondayDate);
						sundayDate.setDate(mondayDate.getDate() + 6);
						const datesObj: Record<string, string> = {};
						for (let d = 0; d < 7; d++) {
							const date = new Date(mondayDate);
							date.setDate(mondayDate.getDate() + d);
							datesObj[d + 1] = getISODate(date);
						};
						for (const key in datesObj) {
							let dateHistoryIndex;
							if (statsFile.history.length > 0) {
								dateHistoryIndex = statsFile.history.findIndex((date: { date: number; time: number; }) => date.date === Number(datesObj[key]));
							} else {
								dateHistoryIndex = -1;
							};
							if (dateHistoryIndex === -1) {
								isWeekComplete = false;
							};
							delete datesObj[key];
						};
						weekLoop++;
						if (isWeekComplete === true) {
							streak++;
						} else {
							break;
						};
					};
					const getLastWeekDates = () => {
						const dates: Record<string, string> = {};
						const today = currentDate.getDay();
						const lastMonday = new Date(currentDate);
						lastMonday.setDate(currentDate.getDate() - today - 6);
						for (let i = 0; i < 7; i++) {
							const date = new Date(lastMonday);
							date.setDate(lastMonday.getDate() + i);
							dates[`lastWeekDay${i + 1}`] = getISODate(date);
						}
						return dates;
					};
					const getCurrentWeekDates = () => {
						const dates: Record<string, string> = {};
						const today = currentDate.getDay();
						const thisMonday = new Date(currentDate);
						thisMonday.setDate(currentDate.getDate() - today + (today === 0 ? -6 : 1));
						for (let i = 0; i < 7; i++) {
							const date = new Date(thisMonday);
							date.setDate(thisMonday.getDate() + i);
							dates[`currentWeekDay${i + 1}`] = getISODate(date);
						}
						return dates;
					};
					const fourteenLastDays = { ...getLastWeekDates(), ...getCurrentWeekDates() };
					const recentDaysCodeTime = [];
					for (const day of Object.keys(fourteenLastDays) as (keyof typeof fourteenLastDays)[]) {
						let dateHistoryIndex;
						if (statsFile.history.length > 0) {
							dateHistoryIndex = statsFile.history.findIndex((date: { date: number; time: number; }) => date.date === Number(fourteenLastDays[day]));
						} else {
							dateHistoryIndex = -1;
						};
						if (dateHistoryIndex === -1) {
							recentDaysCodeTime.push(0);
						} else {
							recentDaysCodeTime.push(statsFile.history[dateHistoryIndex].time);
						};
					};
					const streakArray: number[] = [];
					const streakArrayColor: string[] = [];
					recentDaysCodeTime.forEach((day: number) => {
						if (day > 0) {
							if (day >= 480) {
								streakArray.push(5);
								streakArrayColor.push("rgba(183, 228, 199, 1)");
							} else if (day >= 300) {
								streakArray.push(4);
								streakArrayColor.push("rgba(149, 213, 178, 1)");
							} else if (day >= 180) {
								streakArray.push(3);
								streakArrayColor.push("rgba(149, 213, 178, 0.75)");
							} else if (day >= 60) {
								streakArray.push(2);
								streakArrayColor.push("rgba(149, 213, 178, 0.5)");
							} else {
								streakArray.push(1);
								streakArrayColor.push("rgba(149, 213, 178, 0.25)");
							};	
						} else {
							streakArray.push(0);
							streakArrayColor.push("rgba(0, 0, 0, 0)");
						};
					});
					function getWeeksInYear(year: number): number {
						function getWeek(date: Date): number {
							const oneJan = new Date(date.getFullYear(), 0, 1);
							const numberOfDays = Math.floor((date.getTime() - oneJan.getTime()) / (24 * 60 * 60 * 1000));
							return Math.ceil((date.getDay() + 1 + numberOfDays) / 7);
						};
						return getWeek(new Date(year, 11, 31)) - getWeek(new Date(year, 0, 1)) + 1;
					};
					await dashboardPanel?.webview.postMessage({ id: "updateStreakModule", data: { streakNumber: streak, weeksInYear: getWeeksInYear(new Date().getFullYear()), streakArray: streakArray, colorArray: streakArrayColor } });
				};
				if (message.id === "updateProgessBarModule") {
					const statsFileBuffer = await vscode.workspace.fs.readFile(vscode.Uri.file(path.join(context.extensionPath, "data/stats.json")));
					const statsFile = JSON.parse(statsFileBuffer.toString());
					statsFile.codeTypesList.forEach((type: any) => {
						type.time = type.time / 60;
					});
					const languagesArray = [...statsFile.codeTypesList].sort((a: any, b: any) => b.time - a.time);
					const projectsArray = [...statsFile.projectsList].sort((a: any, b: any) => b.time - a.time);
					await dashboardPanel?.webview.postMessage({ id: "updateProgessBarModule", data: { topLanguagesArray: languagesArray.slice(0, 3), topProjectsArray: projectsArray.slice(0, 3), languagesArray: languagesArray, projectsArray: projectsArray }, method: "preview" });
				};
			}, undefined, context.subscriptions);
    	})
	);

	let settingsPanel: vscode.WebviewPanel | undefined = undefined;
	context.subscriptions.push(
		vscode.commands.registerCommand("staticeSettings", () => {
			if (settingsPanel) {
				const column = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : undefined;
				settingsPanel.reveal(column);
			} else {
				settingsPanel = vscode.window.createWebviewPanel("staticeSettingsWebView", "Statice Settings", vscode.ViewColumn.One, { enableScripts: true, retainContextWhenHidden: true });
				settingsPanel.webview.html = settingsHTML();
				settingsPanel.onDidDispose(() => {
					settingsPanel = undefined;
				}, null, context.subscriptions);
			};
			settingsPanel.webview.onDidReceiveMessage(async message => {
				if (message.id === "loadSettings") {
					settingsPanel?.webview.postMessage({ id: "loadSettings", data: vscode.workspace.getConfiguration() });
				};
				if (message.id === "updateSetting") {
					const configuration = vscode.workspace.getConfiguration();
					if (message.hasOwnProperty("method") === true) {
						if (message.method === "toggle") {
							configuration.update(message.data.section, !vscode.workspace.getConfiguration().get(message.data.section), message.data.configurationTarget);
						};
					} else {
						configuration.update(message.data.section, message.data.value, message.data.configurationTarget);
					};
				};
				if (message.id === "resetStats") {
					const selection = await vscode.window.showInformationMessage("Are you sure you want to permanently delete your stats ?",  "Yes", "No");
					if (selection !== undefined) {
						if (selection === "Yes") {
							try {
								await vscode.workspace.fs.writeFile(vscode.Uri.file(path.join(context.extensionPath, "data/stats.json")), Buffer.from(JSON.stringify({ "totalTime": 0, "codeTypesList": [], "history": [] })))
								.then(async () => {
									await selfCancelingNotification(7500, "Your stats have been deleted.", true);
								});
							} catch (error) {
								statusBarItem.tooltip = "Statice Disable";
								statusBarItem.backgroundColor = new vscode.ThemeColor("statusBarItem.errorBackground");
								await selfCancelingNotification(7500, "Oops, while deleting your stats Statice encountered a problem.", true);
							};
						};
					};
				};
			}, undefined, context.subscriptions);
    	})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand("staticeDocumentation", async () => {
			vscode.commands.executeCommand("markdown.showPreview", vscode.Uri.file(path.join(context.extensionPath, "README.md")));
    	})
	);
};

export function deactivate() {};

function dashboardHTML() {
	return `<!DOCTYPE html>
	<html lang="en">
	<head>
		<meta charset="UTF-8">
		<meta name="viewport" content="width=device-width, initial-scale=1.0">
		<meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' https://fonts.googleapis.com https://devpotatoes.github.io/fonts/; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com/ajax/libs/animejs/2.2.0/anime.js https://cdn.jsdelivr.net/npm/chart.js;">
		<title>Cat Coding</title>
	</head>
	<body>
		<div class="startLogo">
			<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
				<path style="fill:rgba(216, 243, 220, 1);" d="M4.172,4.109l5.354-3.011c0.36-0.223,0.813-0.23,1.162-0.018c0.453,0.275,0.503,0.779,0.507,0.833c0,3.151,0,6.302,0,9.453c0.002,0.073-0.004,0.225-0.093,0.389c-0.074,0.136-0.171,0.22-0.229,0.262c-0.251,0.149-5.959,3.541-8.019,4.513c-0.346,0.163-0.984,0.445-1.441,0.17c-0.367-0.221-0.46-0.708-0.488-0.998c0-2.182,0-4.363,0-6.545C0.925,9.097,0.929,8.554,1.371,8.228c0.39-0.288,0.958-0.286,1.397,0.018c1.449,0.874,2.898,1.748,4.347,2.622c0.59,0.216,1.22,0.073,1.531-0.315c0.421-0.524,0.266-1.503-0.542-1.978C6.631,7.698,5.157,6.822,3.684,5.946C3.63,5.909,3.324,5.683,3.276,5.277c-0.065-0.541,0.388-0.886,0.408-0.9C3.846,4.288,4.009,4.199,4.172,4.109z"/>
				<path style="fill:rgba(216, 243, 220, 1);" d="M19.828,4.109l-5.354-3.011c-0.36-0.223-0.813-0.23-1.162-0.018c-0.453,0.275-0.503,0.779-0.507,0.833c0,3.151,0,6.302,0,9.453c-0.002,0.073,0.004,0.225,0.093,0.389c0.074,0.136,0.171,0.22,0.229,0.262c0.251,0.149,5.959,3.541,8.019,4.513c0.346,0.163,0.984,0.445,1.441,0.17c0.367-0.221,0.46-0.708,0.488-0.998c0-2.182,0-4.363,0-6.545c0.001-0.061-0.003-0.605-0.445-0.931c-0.39-0.288-0.958-0.286-1.397,0.018c-1.449,0.874-2.898,1.748-4.347,2.622c-0.59,0.216-1.22,0.073-1.531-0.315c-0.421-0.524-0.266-1.503,0.542-1.978c1.474-0.876,2.947-1.752,4.421-2.628c0.053-0.038,0.359-0.263,0.408-0.669c0.065-0.541-0.388-0.886-0.408-0.9C20.154,4.288,19.991,4.199,19.828,4.109z"/>
				<path style="fill:rgba(216, 243, 220, 1);" d="M8.694,22.665l-5.328-3.057c-0.376-0.196-0.609-0.577-0.597-0.981c0.016-0.524,0.435-0.818,0.48-0.849c2.774-1.575,5.547-3.151,8.321-4.726c0.063-0.038,0.2-0.109,0.389-0.116c0.157-0.005,0.279,0.036,0.345,0.064c0.257,0.139,6.097,3.307,7.983,4.576c0.317,0.213,0.884,0.616,0.87,1.142c-0.011,0.423-0.393,0.746-0.634,0.915c-1.921,1.091-3.841,2.182-5.762,3.273c-0.054,0.031-0.534,0.3-1.042,0.086c-0.448-0.189-0.73-0.674-0.683-1.2c0.045-1.671,0.09-3.343,0.135-5.014c-0.104-0.61-0.546-1.076-1.043-1.147c-0.672-0.097-1.456,0.525-1.47,1.451c-0.034,1.693-0.069,3.387-0.103,5.08c-0.007,0.064-0.052,0.438-0.385,0.682c-0.443,0.326-0.974,0.112-0.997,0.102C9.014,22.853,8.854,22.759,8.694,22.665z"/>
			</svg>
			<div>STATICE</div>
		</div>
		<div class="dashboardContainer">
			<div class="dashboardMain">
				<div class="dashboardHeader">
					<h1>Dashboard</h1>
					<input type="date">
				</div>
				<div class="chartModule one">
					<div class="chartContainerWrapper">
						<div class="chartContainer">
							<div class="chartInfoWrapper">
								<h2>Total code time</h2>
								<span id="totalCodeTimeValue"></span>
							</div>
							<div class="chartSVG">
								<svg viewBox="0 0 36 36" class="circularChart">
									<path class="circleBackground" d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831a 15.9155 15.9155 0 0 1 0 -31.831"></path>
									<path class="circle" stroke-dasharray="0, 100" d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831a 15.9155 15.9155 0 0 1 0 -31.831"></path>
									<text x="18" y="20.35" class="percentage">0%</text>
								</svg>
							</div>
						</div>
					</div>
					<div class="chartContainerWrapper">
						<div class="chartContainer">
							<div class="chartInfoWrapper">
								<h2 id="dateCodeTimeModumeTitle"></h2>
								<span id="dateCodeTimeValue"></span>
							</div>
							<div class="chartSVG">
								<svg viewBox="0 0 36 36" class="circularChart">
									<path class="circleBackground" d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831a 15.9155 15.9155 0 0 1 0 -31.831"></path>
									<path class="circle" stroke-dasharray="0, 100" d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831a 15.9155 15.9155 0 0 1 0 -31.831"></path>
									<text x="18" y="20.35" class="percentage">0%</text>
								</svg>
							</div>
						</div>
					</div>
					<div class="chartContainerWrapper">
						<div class="chartContainer">
							<div class="chartInfoWrapper">
								<h2>Week Streaks</h2>
								<div class="streakGrid">
									<div></div>
									<div></div>
									<div></div>
									<div></div>
									<div></div>
									<div></div>
									<div></div>
									<div></div>
									<div></div>
									<div></div>
									<div></div>
									<div></div>
									<div></div>
									<div></div>
								</div>
							</div>
							<div class="chartSVG">
								<svg viewBox="0 0 36 36" class="circularChart">
									<path class="circleBackground" d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831a 15.9155 15.9155 0 0 1 0 -31.831"></path>
									<path class="circle" stroke-dasharray="0, 100" d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831a 15.9155 15.9155 0 0 1 0 -31.831"></path>
									<text x="18" y="20.35" class="percentage">0</text>
								</svg>
							</div>
						</div>
					</div>
				</div>
				<div class="chartModule two">
					<div class="chartContainerWrapper big">
						<div class="chartContainer">
							<div class="chartContainerHeader">
								<h2>Graphic code time   (in hours)</h2>
								<span id="ctxInterval"></span>
							</div>
							<div class="lineChart">
								<canvas id="ctx"></canvas>
							</div>
						</div>
					</div>
					<div class="chartContainerWrapper small">
						<div class="chartContainer">
							<div class="chartContainerHeader chartContainerHeaderCodeType">
								<h2>Languages</h2>
							</div>
							<div class="barChart languages">
								<span class="barProgress language1" style="width:0%;"></span>
								<span class="barProgress language2" style="width:0%;"></span>
								<span class="barProgress language3" style="width:0%;"></span>
								<span class="barProgress otherLanguages" style="width:0%;"></span>
							</div>
							<div class="progressBarInfo languages">
								<span class="progressColor language1"></span>
								<span class="progressType">Language 1</span>
								<span class="progressAmount">0%</span>
							</div>
							<div class="progressBarInfo languages">
								<span class="progressColor language2"></span>
								<span class="progressType">Language 2</span>
								<span class="progressAmount">0%</span>
							</div>
							<div class="progressBarInfo languages">
								<span class="progressColor language3"></span>
								<span class="progressType">Language 3</span>
								<span class="progressAmount">0%</span>
							</div>
							<div class="progressBarInfo languages">
								<span class="progressColor otherLanguages"></span>
								<span class="progressType">Other Languages</span>
								<span class="progressAmount">0%</span>
							</div>
							<div class="chartContainerHeader chartContainerHeaderProject">
								<h2>Projects</h2>
							</div>
							<div class="barChart projects">
								<span class="barProgress project1" style="width:0%;"></span>
								<span class="barProgress project2" style="width:0%;"></span>
								<span class="barProgress project3" style="width:0%;"></span>
								<span class="barProgress otherProjects" style="width:0%;"></span>
							</div>
							<div class="progressBarInfo projects">
								<span class="progressColor project1"></span>
								<span class="progressType">Project 1</span>
								<span class="progressAmount">0%</span>
							</div>
							<div class="progressBarInfo projects">
								<span class="progressColor project2"></span>
								<span class="progressType">Project 2</span>
								<span class="progressAmount">0%</span>
							</div>
							<div class="progressBarInfo projects">
								<span class="progressColor project3"></span>
								<span class="progressType">Project 3</span>
								<span class="progressAmount">0%</span>
							</div>
							<div class="progressBarInfo projects">
								<span class="progressColor otherProjects"></span>
								<span class="progressType">Other Projects</span>
								<span class="progressAmount">0%</span>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
		<style>
			@font-face {
				font-family: "MontserratAlt1-Regular";
				src: url("https://devpotatoes.github.io/fonts/MontserratAlt1-Regular.ttf");
			}
			@import url("https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500&display=swap");
			* {
				box-sizing: border-box;
			}
			:root {
				--mainBackgroundColor: rgba(27, 67, 50, 1);
				--secondBackgroundColor: rgba(45, 106, 79, 1);
				--moduleBackgroundColor: rgba(8, 28, 21, 1);
				--primaryColor: rgba(149, 213, 178, 1); 
				--primaryColor0d5: rgba(149, 213, 178, 0.5); 
				--primaryColor0d25: rgba(149, 213, 178, 0.25); 
				--textColor1: rgba(255, 255, 255, 1);
				--textColor2: rgba(135, 135, 135 ,1);
			}
			body {
				height: 100vh;
				width: 100%;
				overflow: hidden;
				display: flex;
				justify-content: center;
				background-color: var(--mainBackgroundColor);
				font-family: "Poppins", sans-serif;
			}
			.startLogo {
				position: absolute;
				top: 50%;
				transform: translateY(-50%);
				display: flex;
				align-items: center;
				justify-content: center;
				font-family: "MontserratAlt1-Regular", sans-serif;
			}
			.startLogo > svg {
				position: relative;
				flex: 0 0 3.75rem;
				width: 3.75rem;
				z-index: 2;
			}
			.startLogo > div {
				position: relative;
				overflow: hidden;
				font-size: 2rem;
				margin: 0.5rem 0 0 0.5rem;
			}
			.dashboardContainer {
				width: 100%;
				height: 100%;
				display: flex;
				position: relative;
				max-width: 1680px;
				overflow-y: auto;
				overflow-x: hidden;
				opacity: 0;
				transition: opacity 0.75s ease;
			}
			.dashboardMain {
				flex: 1;
				height: 100%;
				overflow-y: auto;
				overflow-x: hidden;
				background-color: var(--secondBackgroundColor);
				padding: 0 2rem 1rem 2rem;
			}
			.dashboardHeader {
				display: flex;
				align-items: center;
				justify-content: space-between;
				margin-bottom: -0.75rem;
			}
			.dashboardHeader h1 {
				color: var(--textColor1);
				font-size: 2rem;
				margin-left: 1.5rem;
			}
			input[type="date"] {
				background-color: var(--moduleBackgroundColor);
				padding: 0.35rem;
				color: var(--textColor1);
				font-size: 0.95rem;
				border: none;
				outline: none;
				border-radius: 0.65rem;
				margin-right: 1.5rem;
			}
			input[type="date"]::-webkit-calendar-picker-indicator {
				background-color: var(--textColor1);
				padding: 0.45rem;
    			cursor: pointer;
    			border-radius: 0.5rem;
			}
			.chartModule {
				display: flex;
				justify-content: space-between;
				margin: 0 -8px;
			}
			.chartModule.one .chartContainerWrapper {
				width: 33.3%;
			}
			.chartModule.one .chartContainerWrapper .chartContainer {
				justify-content: space-between;
			}
			.chartModule.two .big {
				flex: 1;
				max-width: 77.7%;
			}
			.chartModule.two .big .chartContainer {
				flex-direction: column;
			}
			.chartModule.two .small {
				width: 33.3%;
			}
			.chartModule.two .small .chartContainer {
				flex-direction: column;
			}
			.chartModule.two .small .chartContainer + .chartContainer {
				margin-top: 16px;
			}
			.lineChart {
				width: 100%;
				margin-top: 24px;
			}
			.chartContainer {
				width: 100%;
				border-radius: 1.25rem;
				background-color: var(--moduleBackgroundColor);
				padding: 16px;
				display: flex;
				align-items: center;
			}
			.chartContainerWrapper {
				padding: 8px;
			}
			.chartInfoWrapper {
				flex-shrink: 0;
				flex-basis: 120px;
			}
			.chartInfoWrapper h2 {
				color: var(--textColor2);
				font-size: 12px;
				line-height: 16px;
				font-weight: 600;
				text-transform: uppercase;
				margin: 0 0 8px 0;
			}
			.chartInfoWrapper span {
				color: var(--textColor1);
				font-size: 24px;
				line-height: 32px;
				font-weight: 500;
			}
			.chartSVG {
				position: relative;
				max-width: 90px;
				min-width: 40px;
				flex: 1;
			}
			.circleBackground {
				fill: none;
				stroke: var(--textColor1);
				stroke-width: 1.2;
			}
			.circle {
				fill: none;
				stroke-width: 1.6;
				stroke-linecap: round;
				animation: progress 1s ease-out forwards;
			}
			.circularChart .circle {
				stroke: var(--primaryColor);
			}
			.circularChart .circleBackground {
				stroke: var(--primaryColor0d5);
			}
			.percentage {
				fill: var(--textColor1);
				font-size: 0.5em;
				text-anchor: middle;
				font-weight: 400;
			}
			@keyframes progress {
				0% {
					stroke-dasharray: 0 100;
				}
			}
			.streakGrid {
				display: grid;
				grid-template-columns: repeat(7, 1.5rem);
				gap: 10px;
				justify-content: center;
				align-items: center;
			}
			.streakGrid > div {
				width: 1.5rem;
				height: 1.5rem;
				border-style: solid;
				border-width: 1px;
				border-color: var(--primaryColor0d25);
				border-radius: 0.35rem;
			}
			.chartContainerHeader {
				display: flex;
				justify-content: space-between;
				align-items: center;
				width: 100%;
				margin-bottom: 12px;
			}
			.chartContainerHeaderProject {
				margin-top: 3rem
			}
			.chartContainerHeader h2 {
				margin: 0;
				color: var(--textColor1);
				font-size: 12px;
				line-height: 16px;
				opacity: 0.8;
			}
			.chartContainerHeader span {
				color: var(--textColor2);
				font-size: 12px;
				line-height: 16px;
			}
			.barChart {
				width: 100%;
				height: 4px;
				border-radius: 4px;
				margin-top: 16px;
				margin-bottom: 8px;
				display: flex;
			}
			.barProgress {
				height: 4px;
				display: inline-block;
			}
			.barProgress.language1 {
				background-color: rgba(183, 228, 199, 1);
			}
			.barProgress.language2 {
				background-color: rgba(116, 198, 157, 1);
			}
			.barProgress.language3 {
				background-color: rgba(45, 106, 79, 1);
			}
			.barProgress.otherLanguages {
				background-color: rgba(27, 67, 50, 1);
			}
			.barProgress.project1 {
				background-color: rgba(183, 228, 199, 1);
			}
			.barProgress.project2 {
				background-color: rgba(116, 198, 157, 1);
			}
			.barProgress.project3 {
				background-color: rgba(45, 106, 79, 1);
			}
			.barProgress.otherProjects {
				background-color: rgba(27, 67, 50, 1);
			}
			.progressBarInfo {
				display: flex;
				align-items: center;
				margin-top: 8px;
				width: 100%;
			}
			.progressColor {
				width: 10px;
				height: 10px;
				border-radius: 50%;
				margin-right: 8px;
			}
			.progressColor.language1 {
				background-color: rgba(183, 228, 199, 1);
			}
			.progressColor.language2 {
				background-color: rgba(116, 198, 157, 1);
			}
			.progressColor.language3 {
				background-color: rgba(45, 106, 79, 1);
			}
			.progressColor.otherLanguages {
				background-color: rgba(27, 67, 50, 1);
			}
			.progressColor.project1 {
				background-color: rgba(183, 228, 199, 1);
			}
			.progressColor.project2 {
				background-color: rgba(116, 198, 157, 1);
			}
			.progressColor.project3 {
				background-color: rgba(45, 106, 79, 1);
			}
			.progressColor.otherProjects {
				background-color: rgba(27, 67, 50, 1);
			}
			.progressType {
				color: var(--textColor2);
				font-size: 12px;
				line-height: 16px;
			}
			.progressAmount {
				color: var(--textColor2);
				font-size: 12px;
				line-height: 16px;
				margin-left: auto;
			}
			@media screen and (max-width: 1200px) {
				.dashboardMain .open-right-area {
					display: flex;
					color: var(--textColor1);
				}
			}
			@media screen and (max-width: 1180px) {
				.chartModule.two {
					flex-direction: column;
				}
				.chartModule.two .big {
					max-width: 100%;
				}
				.chartModule.two .small {
					display: flex;
					justify-content: space-between;
					width: 100%;
				}
				.chartModule.two .small .chartContainer {
					width: 100%;
				}
				.streakGrid {
					grid-template-columns: repeat(7, 0.85rem);
				}
				.streakGrid > div {
					width: 0.85rem;
					height: 0.85rem;
					border-radius: 0.15rem;
				}
			}
			@media screen and (max-width: 700px) {
				.chartModule.one {
					flex-direction: column;
				}
				.chartModule.one .chartContainerWrapper {
					width: 100%;
				}
				.chartSVG {
					min-height: 60px;
					min-width: 40px;
				}
				.streakGrid {
					grid-template-columns: repeat(7, 1.5rem);
				}
				.streakGrid > div {
					width: 1.5rem;
					height: 1.5rem;
					border-radius: 0.35rem;
				}
			}
			@media screen and (max-width: 520px) {
				.chartModule.two .small {
					flex-direction: column;
				}
				.dashboardHeader {
					display: flex;
					align-items: center;
					margin-bottom: -0.75rem;
				}
				.dashboardHeader {
					margin-bottom: 0.5rem;
				}
				.dashboardHeader h1 {
					font-size: 1.5rem;
				}
			}
		</style>
		<script src="https://cdnjs.cloudflare.com/ajax/libs/animejs/2.2.0/anime.js"></script>
		<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
		<script>
			const vscode = acquireVsCodeApi();
			const dateInput = document.querySelector('input[type="date"]');
			let chartInstance = null;
			document.addEventListener("DOMContentLoaded", () => {
				vscode.postMessage({ id: "loadCSSVariable" });
				const currentDate = new Date();
				dateInput.value = currentDate.getFullYear() + "-" + (currentDate.getMonth() + 1).toString().padStart(2, "0") + "-" + currentDate.getDate().toString().padStart(2, "0");
				const annee = currentDate.getFullYear();
				const mois = String(currentDate.getMonth() + 1).padStart(2, '0');
				const jour = String(currentDate.getDate()).padStart(2, '0');
			});
			window.addEventListener("message", (event) => {
				const message = event.data;
				if (message.id === "loadCSSVariable") {
					if (message.data === "Light") {
						document.documentElement.style.setProperty("--mainBackgroundColor", "rgba(27, 67, 50, 1)");
						document.documentElement.style.setProperty("--secondBackgroundColor", "rgba(45, 106, 79, 1)");
						document.documentElement.style.setProperty("--moduleBackgroundColor", "rgba(8, 28, 21, 1)");
						document.documentElement.style.setProperty("--primaryColor", "rgba(149, 213, 178, 1)");
						document.documentElement.style.setProperty("--primaryColor0d5", "rgba(149, 213, 178, 0.5)");
						document.documentElement.style.setProperty("--primaryColor0d25", "rgba(149, 213, 178, 0.25)");
					} else if (message.data === "Dark") {
						document.documentElement.style.setProperty("--mainBackgroundColor", "rgba(52, 58, 64, 1)");
						document.documentElement.style.setProperty("--secondBackgroundColor", "rgba(108, 117, 125, 1)");
						document.documentElement.style.setProperty("--moduleBackgroundColor", "rgba(33, 37, 41, 1)");
						document.documentElement.style.setProperty("--primaryColor", "rgba(173, 181, 189, 1)");
						document.documentElement.style.setProperty("--primaryColor0d5", "rgba(173, 181, 189, 0.5)");
						document.documentElement.style.setProperty("--primaryColor0d25", "rgba(173, 181, 189, 0.25)");
					};
				};
				if (message.id === "loadChart") {
					let currentDate = new Date();
					const ctx = document.getElementById("ctx").getContext("2d");
					ctx.canvas.height = 100;
					const gradient = ctx.createLinearGradient(0, 25, 0, 300);
					gradient.addColorStop(0, message.data.colors.green.half);
					gradient.addColorStop(0.35, message.data.colors.green.quarter);
					gradient.addColorStop(1, message.data.colors.green.zero);
					message.data.options.data.datasets[0].backgroundColor = gradient;
					message.data.options.options.plugins.tooltip.callbacks = {
						title: (context) => {
							let labelDate = new Date(message.data.dates.mondayDate);
							labelDate.setDate(labelDate.getDate() + context[0].dataIndex);
							labelDate = (labelDate.getMonth() + 1).toString().padStart(2, "0") + "-" + labelDate.getDate().toString().padStart(2, "0") + "-" + labelDate.getFullYear();
							return context[0].label + "   (" + labelDate + ")";
						},
						label: (context) => {
							const yValue = context.parsed.y;
							const hours = Math.floor(yValue);
							const minutes = Math.round((yValue - hours) * 60);
							if (hours <= 0) {
								return " " + minutes + "min";
							} else {
								return " " + hours + "h " + minutes + "min";
							};
						},
						labelColor: (context) => {
							return { borderColor: context.dataset.borderColor };
						},
						labelPointStyle: (context) => {
							return { pointStyle: "line", rotation: 0 };
						}
					};
					chartInstance = new Chart(ctx, message.data.options);
					document.querySelectorAll("#ctxInterval").forEach(element => {
						const mondayDate = new Date(message.data.dates.mondayDate);
						mondayDate.setDate(mondayDate.getDate());
						mondayDate.setHours(0, 0, 0, 0);
						const sundayDate = new Date(message.data.dates.sundayDate);
						sundayDate.setDate(sundayDate.getDate());
						sundayDate.setHours(23, 59, 59, 999);
						if (currentDate >= mondayDate && currentDate <= sundayDate) {
							element.textContent = "This week";
						} else {
							element.textContent = (mondayDate.getMonth() + 1).toString().padStart(2, "0") + "/" + mondayDate.getDate().toString().padStart(2, "0") + "/" + mondayDate.getFullYear() + " to " + (sundayDate.getMonth() + 1).toString().padStart(2, "0") + "/" + sundayDate.getDate().toString().padStart(2, "0") + "/" + sundayDate.getFullYear();
						};
					});
					if (currentDate.toISOString().split("T")[0] === dateInput.value) {
						document.getElementById("dateCodeTimeModumeTitle").textContent = "Today";
					} else {
						currentDate = new Date(dateInput.value);
						document.getElementById("dateCodeTimeModumeTitle").textContent = (currentDate.getMonth() + 1).toString().padStart(2, "0") + "-" + currentDate.getDate().toString().padStart(2, "0") + "-" + currentDate.getFullYear();
					};
				};
				if (message.id === "updateChartSVG") {
					const chartSVG = document.querySelectorAll(".chartSVG");
					chartSVG[0].querySelector(".circle").setAttribute("stroke-dasharray", message.data.total + ", 100");
					if (message.data.total > 0) {
						chartSVG[0].querySelector(".percentage").textContent = "+" + Math.round(message.data.total) + "%";
					} else {
						chartSVG[0].querySelector(".percentage").textContent = Math.round(message.data.total) + "%";
					};
					chartSVG[1].querySelector(".circle").setAttribute("stroke-dasharray", message.data.day + ", 100");
					if (message.data.day > 0) {
						chartSVG[1].querySelector(".percentage").textContent = "+" + Math.round(message.data.day) + "%";
					} else {
						chartSVG[1].querySelector(".percentage").textContent = Math.round(message.data.day) + "%";
					};
				};
				if (message.id === "updateCodeTimeModule") {
					document.getElementById("totalCodeTimeValue").textContent = message.data.total;
					document.getElementById("dateCodeTimeValue").textContent = message.data.day;
				};
				if (message.id === "updateStreakModule") {
					const day = document.querySelectorAll(".streakGrid > div");
					const chartSVG = document.querySelectorAll(".chartSVG");
					const streakArrayColor = message.data.colorArray;
					day.forEach((day, index) => {
						day.style.backgroundColor = streakArrayColor[index];
					});
					chartSVG[2].querySelector(".circle").setAttribute("stroke-dasharray", (message.data.streakNumber / message.data.weeksInYear) * 100 + ", 100");
					chartSVG[2].querySelector(".percentage").textContent = message.data.streakNumber;
				};
				if (message.id === "updateProgessBarModule") {
					const barProgressChartContainer = document.querySelector(".chartContainer");
					const barChartLanguages = document.querySelector(".barChart.languages");
					const progressBarInfoLanguages = document.querySelectorAll(".progressBarInfo.languages");
					const barProgressElements1 = barChartLanguages.querySelectorAll(".barProgress");
					const totalLanguagesArraySum = [...message.data.languagesArray].reduce((total, current) => total + current.time, 0);
					const otherLanguagesArraySum = [...message.data.languagesArray].slice(3).reduce((total, current) => total + current.time, 0);
					const iterations1 = Math.min(message.data.languagesArray.length, 4);
					for (let i = 0; i < iterations1; i++) {
						if (i < 3) {
							barProgressElements1[i].style.width = (message.data.topLanguagesArray[i].time / totalLanguagesArraySum) * 100 + "%";
						} else {
							barProgressElements1[i].style.width = (otherLanguagesArraySum / totalLanguagesArraySum) * 100 + "%";
						};
					};
					for (let i = 0; i < iterations1; i++) {
						const progressType = progressBarInfoLanguages[i].querySelector(".progressType");
						const progressAmount = progressBarInfoLanguages[i].querySelector(".progressAmount");
						if (i < 3) {
							progressType.textContent = message.data.topLanguagesArray[i].type;
							progressAmount.textContent = ((message.data.topLanguagesArray[i].time / totalLanguagesArraySum) * 100).toFixed(2) + "%";
						} else {
							progressType.textContent = "Other Languages";
							progressAmount.textContent = (((otherLanguagesArraySum / totalLanguagesArraySum) * 100) + 0.01).toFixed(2) + "%";
						};
					};
					if (message.data.languagesArray.length < 4) {
						for (let i = iterations1; i < progressBarInfoLanguages.length; i++) {
							progressBarInfoLanguages[i].remove();
						};
					};
					const barChartProjects = document.querySelector(".barChart.projects");
					const progressBarInfoProjects = document.querySelectorAll(".progressBarInfo.projects");
					const barProgressElements2 = barChartProjects.querySelectorAll(".barProgress");
					const totalProjectsArraySum = [...message.data.projectsArray].reduce((total, current) => total + current.time, 0);
					const otherProjectsArraySum = [...message.data.projectsArray].slice(3).reduce((total, current) => total + current.time, 0);
					const iterations2 = Math.min(message.data.projectsArray.length, 4);
					for (let i = 0; i < iterations2; i++) {
						if (i < 3) {
							barProgressElements2[i].style.width = (message.data.topProjectsArray[i].time / totalProjectsArraySum) * 100 + "%";
						} else {
							barProgressElements2[i].style.width = (otherProjectsArraySum / totalProjectsArraySum) * 100 + "%";
						};
					};
					for (let i = 0; i < iterations2; i++) {
						const progressType = progressBarInfoProjects[i].querySelector(".progressType");
						const progressAmount = progressBarInfoProjects[i].querySelector(".progressAmount");
						if (i < 3) {
							progressType.textContent = message.data.topProjectsArray[i].name;
							progressAmount.textContent = ((message.data.topProjectsArray[i].time / totalProjectsArraySum) * 100).toFixed(2) + "%";
						} else {
							progressType.textContent = "Other Projects";
							progressAmount.textContent = (((otherProjectsArraySum / totalProjectsArraySum) * 100) + 0.01).toFixed(2) + "%";
						};
					};
					if (message.data.projectsArray.length < 4) {
						for (let i = iterations2; i < progressBarInfoProjects.length; i++) {
							progressBarInfoProjects[i].remove();
						};
					};
				};
			});
			const startAnimation = anime.timeline({ autoplay: true, delay: 200 });
			startAnimation.add({ targets: document.querySelector(".startLogo svg"), translateY: [-100, 0], opacity: [0, 1], elasticity: 250, duration: 1600 }).add({ targets: document.querySelector(".startLogo div"), translateX: ["-1rem", 0], opacity: [0, 1], duration: 1000, easing: "easeOutExpo", offset: 1000 });
			setTimeout(() => {
				document.querySelector(".startLogo").style.display = "none";
				document.querySelector(".dashboardContainer").style.opacity = "1";
				vscode.postMessage({ id: "loadChart", data: dateInput.value });
				vscode.postMessage({ id: "updateChartSVG" });
				vscode.postMessage({ id: "updateCodeTimeModule", data: dateInput.value });
				vscode.postMessage({ id: "updateStreakModule" });
				vscode.postMessage({ id: "updateProgessBarModule" });
			}, 2500);
			dateInput.addEventListener("change", () => {
				chartInstance.destroy();
				vscode.postMessage({ id: "loadChart", data: dateInput.value });
				vscode.postMessage({ id: "updateChartSVG" });
				vscode.postMessage({ id: "updateCodeTimeModule", data: dateInput.value });
				vscode.postMessage({ id: "updateProgessBarModule" });
			});
		</script>
	<body>
	</html>`;
};

function settingsHTML() {
	return `<!DOCTYPE html>
	<html lang="en">
	<head>
		<meta charset="UTF-8">
		<meta name="viewport" content="width=device-width, initial-scale=1.0">
		<meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' https://fonts.googleapis.com; script-src 'self' 'unsafe-inline'">
		<title>Cat Coding</title>
	</head>
	<body>
		<div class="settings">
			<div class="settingsHeader">
				<h2 class="settingsHeaderTitle">Settings</h2>
				<div class="themeSwitcher">
					<input type="radio" id="lightThemeInput" name="themes" checked/>
					<label for="lightThemeInput">
						<span>
							Light
						</span>
					</label>
					<input type="radio" id="darkThemeInput" name="themes"/>
					<label for="darkThemeInput">
						<span>
							Dark
						</span>
					</label>
					<input type="radio" id="autoThemeInput" name="themes"/>
					<label for="autoThemeInput">
						<span>
							Auto
						</span>
					</label>
					<span class="slider"></span>
				</div>
			</div>
			<div class="settingsBody">
				<span>Enable notifications ? <input type="checkbox" id="toggleSwitch1"/><label class="toggleSwitch" for="toggleSwitch1"></label></span>
				<span class="resetButton">Reset Stats</span>
			</div>
		</div>
		<style>
			:root {
				--mainBackgroundColor: rgba(52, 58, 64, 1);
				--secondBackgroundColor: rgba(108, 117, 125, 1);
				--moduleBackgroundColor: rgba(33, 37, 41, 1);
				--primaryColor: rgba(173, 181, 189, 1);
				--primaryColor0d5: rgba(173, 181, 189, 0.5);
				--primaryColor0d25: rgba(173, 181, 189, 0.25);
				--textColor1: rgba(255, 255, 255, 1);
				--textColor2: rgba(135, 135, 135 ,1);
			}
			@import url("https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500&display=swap");
			* {
				box-sizing: border-box;
			}
			body {
				display: flex;
				font-family: sans-serif;
				line-height: 1.5;
				justify-content: center;
				transform: background-color 1s ease;
				color: var(--textColor1);
			}
			.settings {
				width: 90%;
				margin-top: 80px;
				max-width: 320px;
				background-color: var(--mainBackgroundColor);
				transition: background-color 0.30s ease;
				border-radius: 1.5rem;
			}
			.settingsHeader {
				padding: 1rem;
			}
			.settingsHeaderTitle {
				font-size: 1.5rem;
				color: var(--textColor1);
				text-align: center;
				font-weight: 700;
			}
			.themeSwitcher input {
				display: none;
			}
			.themeSwitcher {
				position: relative;
				background-color: var(--primaryColor0d5);
				border-radius: 0.65rem;
				display: flex;
				padding: 0 3px;
			}
			.themeSwitcher label {
				position: relative;
				z-index: 2;
				width: calc(100% / 3);
				color: var(--textColor1);
			}
			.themeSwitcher label span {
				padding: 8px 0;
				display: flex;
				justify-content: center;
				font-weight: 600;
				opacity: 0.85;
			}
			.themeSwitcher label span:hover {
				opacity: 1;
				cursor: pointer;
			}
			.themeSwitcher .slider {
				position: absolute;
				z-index: 1;
				width: calc((100% - 6px) / 3);
				top: 3px;
				transform: translatex(-110%);
				bottom: 3px;
				border-radius: 0.5rem;
				transition: 0.30s ease, transform 0.25s ease-out;
				background-color: var(--mainBackgroundColor);
			}
			.themeSwitcher input:nth-of-type(1):checked ~ .slider {
				transform: translateX(0);
			}
			.themeSwitcher input:nth-of-type(2):checked ~ .slider {
				transform: translateX(100%);
			}
			.themeSwitcher input:nth-of-type(3):checked ~ .slider {
				transform: translateX(200%);
			}
			.settingsBody {
				padding: 1rem;
				border-top: 1px solid var(--moduleBackgroundColor);
				transition: border-color 0.30s ease;
			}
			.settingsBody span {
				text-decoration: none;
				color: inherit;
				display: flex;
				padding: 0.6rem 0.5rem;
				border-radius: 0.35rem;
				font-weight: 500;
				transition: 0.30s ease;
			}		
			.settingsBody .resetButton {
				display: flex;
				justify-content: center;
				align-items: center;
				margin-top: 2rem;
				border-style: solid;
				border-width: 1px;
				border-color: rgba(230, 57, 70, 1);
			}			
			.settingsBody span:hover {
				background-color: var(--primaryColor0d25);
			}
			.settingsBody .resetButton:hover {
				background-color: rgba(230, 57, 70, 1);
			}
			input[type=checkbox] {
				height: 0;
				width: 0;
				visibility: hidden;
			}
			.toggleSwitch {
				cursor: pointer;
				position: relative;
				width: 2.5rem;
				height: 1rem;
				background: grey;
				display: block;
			  margin-left: auto;
				border-radius: 100rem;
			  transform: translateY(12.5%);
			}
			.toggleSwitch:after {
				content: "";
				position: absolute;
				top: 2px;
			  	left: 3px;
				width: 0.75rem;
				height: 0.75rem;
				background: rgba(203, 248, 219, 1);
				border-radius: 100px;
				transition: 0.3s;
			}
			input[type=checkbox]:checked + .toggleSwitch {
				background: rgba(116, 198, 157, 1);
			}
			input[type=checkbox]:checked + .toggleSwitch:after {
				left: calc(100% - 3px);
				transform: translateX(-100%);
			}
			.toggleSwitch:active:after {
				width: 85%;
			}
		</style>
		<script>
			const vscode = acquireVsCodeApi();
			document.addEventListener("DOMContentLoaded", () => {
				vscode.postMessage({ id: "loadSettings" });
			});
			window.addEventListener("message", (event) => {
				const message = event.data;
				if (message.id === "loadSettings") {
					const configuration = message.data;
					document.getElementById("lightThemeInput").checked = false;
					if (configuration.statice["theme"] === "Light") {
						document.getElementById("lightThemeInput").checked = true;
					} else if (configuration.statice["theme"] === "Dark") {
						document.getElementById("darkThemeInput").checked = true;
					} else {
						document.getElementById("autoThemeInput").checked = true;
					};
					if (configuration.statice["notifications"] === true) {
						document.getElementById("toggleSwitch1").checked = true;
					};
				};
			});
			document.querySelectorAll('.themeSwitcher input[type="radio"]').forEach(radio => {
				radio.addEventListener("change", (event) => {
					if (event.target.id === "lightThemeInput") {
						vscode.postMessage({ id: "updateSetting", data: { section: "statice.theme", value: "Light", configurationTarget: true } });
					};
					if (event.target.id === "darkThemeInput") {
						vscode.postMessage({ id: "updateSetting", data: { section: "statice.theme", value: "Dark", configurationTarget: true } });
					};
					if (event.target.id === "autoThemeInput") {
						vscode.postMessage({ id: "updateSetting", data: { section: "statice.theme", value: "Auto", configurationTarget: true } });
					};
				});
			});
			document.querySelectorAll(".toggleSwitch").forEach(toggleSwitch => {
				toggleSwitch.addEventListener("click", (event) => {
					if (event.target.getAttribute("for") === "toggleSwitch1") {
						vscode.postMessage({ id: "updateSetting", data: { section: "statice.notifications", value: "", configurationTarget: true }, method: "toggle" });
					};
				});
			});
			document.querySelector(".resetButton").addEventListener("click", () => {
				vscode.postMessage({ id: "resetStats" });
			});
		</script>
	<body>
	</html>`;
};