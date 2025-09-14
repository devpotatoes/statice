const vscode = acquireVsCodeApi();

let extensionSettingsObj = {};

let wcoConfig = {};

const bodyEl = document.querySelector("body");
const appSplashSreenEl = bodyEl.querySelector("#appSplashSreen");
const reloadBtnEl = bodyEl.querySelector("button.reloadBtn");
const dateBtnEl = bodyEl.querySelector("button.dateBtn");
const dialogBoxContainerEl = bodyEl.querySelector("#dialogBoxContainer");
const datePickerMenuEl = dialogBoxContainerEl.querySelector("#datePickerMenu");
const monthLabelEl = datePickerMenuEl.querySelector("div.header > span.month");
const yearInputEl = datePickerMenuEl.querySelector("div.header > input.yearInput");
const previousMonthBtnEl = datePickerMenuEl.querySelector("div.header > button.previousMonthBtn");
const nextMonthBtnEl = datePickerMenuEl.querySelector("div.header > button.nextMonthBtn");
const daysGridEl = datePickerMenuEl.querySelector("div.body > div.daysGrid");
const cancelDatePickerBtnEl = datePickerMenuEl.querySelector("div.footer > button.cancelDatePickerBtn");
const thisWeekBtnEl = datePickerMenuEl.querySelector("div.footer > button.thisWeekBtn");
const settingsBtnEl = bodyEl.querySelector("button.settingsBtn");
const settingsMenuEl = dialogBoxContainerEl.querySelector("#settingsMenu");
const themeSelectInputElArray = settingsMenuEl.querySelectorAll("div.body > div:nth-of-type(1) > div.themeSelectContainer > div.themeSelectInput");
const closeMenuBtnElArray = dialogBoxContainerEl.querySelectorAll("div.header > button.closeMenuBtn");
const toggleSwitchElArray = bodyEl.querySelectorAll("div.toggleSwitch");
const enableNotificationsSettingToggleSwitchEl = settingsMenuEl.querySelector("#enableNotificationsSettingToggleSwitch");
const enableBackupsSettingToggleSwitchEl = settingsMenuEl.querySelector("#enableBackupsSettingToggleSwitch");
const accountBtnEl = bodyEl.querySelector("button.accountBtn");
const accountMenuEl = dialogBoxContainerEl.querySelector("#accountMenu");
const importStatsBtnEl = accountMenuEl.querySelector("button.importStatsBtn");
const exportStatsBtnEl = accountMenuEl.querySelector("button.exportStatsBtn");
const displayBackupsBtnEl = accountMenuEl.querySelector("button.displayBackupsBtn");
const resetStatsBtnEl = accountMenuEl.querySelector("button.resetStatsBtn");
const backupsMenuEl = dialogBoxContainerEl.querySelector("#backupsMenu");
const emptyBackupFolderEl = backupsMenuEl.querySelector("div.body > div:nth-of-type(1) > div.emptyBackupFolder");
const totalTimeModuleTextEl = bodyEl.querySelector("div.totalTimeModule > div > span");
const todayTimeModuleTextEl = bodyEl.querySelector("div.todayTimeModule > div > span");
const todayTimeModuleChartTextEl = bodyEl.querySelector("div.todayTimeModule > div.moduleInfoWrapper > div.progressChart > span");
const todayTimeModuleProgressChartPathEl = bodyEl.querySelector("div.todayTimeModule > div.moduleInfoWrapper > div.progressChart > svg > path:nth-of-type(2)");
const weekStreakModuleStreakGrid = bodyEl.querySelectorAll("div.streakGrid > div");
const weekStreakModuleChartTextEl = bodyEl.querySelector("div.weekStreakModule > div.moduleInfoWrapper > div.progressChart > span");
const weekStreakModuleProgressChartPathEl = bodyEl.querySelector("div.weekStreakModule > div.moduleInfoWrapper > div.progressChart > svg > path:nth-of-type(2)");
const lineChartEl = bodyEl.querySelector("div.lineChart");
const canvasEl = bodyEl.querySelector("#ctx");
const weekChartModuleHeaderRangeDateEl = bodyEl.querySelector("div.weekChartModule > div.moduleHeader > span");
const globalStatsModuleElArray = bodyEl.querySelectorAll("div.globalStatsModule");

const colorsVariablesArray = [
    "--borderColor",
    "--greenLevelColor1",
    "--greenLevelColor2",
    "--greenLevelColor3",
    "--greenLevelColor4",
    "--headerBackgroundColor",
    "--textColor2"
];

let chartInstance = null;

let openMenuName = "";

let datePickerDate = new Date();
let selectedDate = new Date();

async function newAlert(type, containerEl, message) {
    const alertIsAlreadyDisplayed = Array.from(containerEl.querySelectorAll(`${type}-alert > p`)).some(p => p.innerText === message);

    if (alertIsAlreadyDisplayed === false) {
        const alertDataObj = {
            message: message
        };
        
        const alertComponent = await wco.render(wcoConfig.urls.wco[`${type}Alert`], wcoConfig.urls.schemas[`${type}Alert`], alertDataObj);

        containerEl.insertAdjacentHTML("afterbegin", alertComponent);

        setTimeout(() => {
            Array.from(containerEl.querySelectorAll(`${type}-alert > p`)).find(p => p.innerText === message).parentElement.remove();
        }, 15000);
    };
};

function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
        return `${hours}h ${minutes}min`;
    } else {
        return `${minutes}min`;
    };
};

function resizeCanvas() {
    const lineChartWidth = lineChartEl.offsetWidth;
    chartInstance.resize(lineChartWidth - 32, lineChartWidth / 2.5);

    const ctx = canvasEl.getContext("2d");
    
    const gradientObj = ctx.createLinearGradient(0, lineChartWidth / 2.5, 0, 0);
    gradientObj.addColorStop(0, "rgba(0, 0, 0, 0)");
    gradientObj.addColorStop(0.25, `rgba(${chartInstance.config._config.customData.colorVariablesObj["--greenLevelColor1"]}, 0.175)`);
    gradientObj.addColorStop(0.5, `rgba(${chartInstance.config._config.customData.colorVariablesObj["--greenLevelColor2"]}, 0.25)`);
    gradientObj.addColorStop(0.75, `rgba(${chartInstance.config._config.customData.colorVariablesObj["--greenLevelColor3"]}, 0.325)`);
    gradientObj.addColorStop(1, `rgba(${chartInstance.config._config.customData.colorVariablesObj["--greenLevelColor4"]}, 0.5)`);
    chartInstance.config._config.data.datasets[0].backgroundColor = gradientObj;

    chartInstance.update();
};

function renderCalendar(date) {
    const datePickerYear = date.getFullYear();
    const datePickerMonth = date.getMonth();

    const firstDayIndex = (new Date(datePickerYear, datePickerMonth, 1).getDay() + 6) % 7;
    const numberOfDays = new Date(datePickerYear, datePickerMonth + 1, 0).getDate();

    monthLabelEl.textContent = date.toLocaleString("default", { month: "short" });
    yearInputEl.value = datePickerYear;

    daysGridEl.innerHTML = "";

    for (let day = 0; day < firstDayIndex; day += 1) {
        const newDayCellEl = document.createElement("div");
        newDayCellEl.classList.add("placeholderDay");
        daysGridEl.appendChild(newDayCellEl);
    };

    let selectedWeekRangeObj;

    if (selectedDate != null) {
        const dayOfWeek = (selectedDate.getDay() + 6) % 7;

        const startOfWeek = new Date(selectedDate);
        startOfWeek.setDate(selectedDate.getDate() - dayOfWeek);
        startOfWeek.setHours(0, 0, 0, 0);

        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(0, 0, 0, 0);

        selectedWeekRangeObj = {
            startOfWeekDate: startOfWeek,
            endOfWeekDate: endOfWeek
        };
    };

    for (let day = 1; day <= numberOfDays; day += 1) {
        const currentDate = new Date(datePickerYear, datePickerMonth, day);

        const newDayCellEl = document.createElement("div");
        newDayCellEl.textContent = day;

        if (currentDate >= selectedWeekRangeObj.startOfWeekDate && currentDate <= selectedWeekRangeObj.endOfWeekDate) {
            newDayCellEl.classList.add("selectedWeek");

            if (currentDate.getTime() === selectedWeekRangeObj.startOfWeekDate.getTime()) {
                newDayCellEl.classList.add("startOfWeek");
            };

            if (currentDate.getTime() === selectedWeekRangeObj.endOfWeekDate.getTime()) {
                newDayCellEl.classList.add("endOfWeek");
            };  
        };
        daysGridEl.appendChild(newDayCellEl);

        newDayCellEl.addEventListener("click", () => {
            selectedDate = currentDate;

            vscode.postMessage(
                {
                    id: "fetchStatsData",
                    data: {
                        date: selectedDate
                    }
                }
            );

            renderCalendar(date);

            setTimeout(() => {
                cancelDatePickerBtnEl.click();
            }, 125);
        });
    };
};

document.addEventListener("DOMContentLoaded", () => {
    vscode.postMessage(
        {
            id: "getAllSettings"
        }
    );

    wco.setConfig(
        {
            schemasPath: "/src/wco/schemas",
            wcoPath: "/src/wco"
        }
    );

    wcoConfig = wco.getConfig();

    vscode.postMessage(
        {
            id: "genWcoUrls",
            data: {
                schemasPath: wcoConfig.schemasPath,
                wcoPath: wcoConfig.wcoPath
            }
        }
    );

    vscode.postMessage(
        {
            id: "loadColorVariables",
            data: {
                colorVariablesObj: colorsVariablesArray.reduce((acc, name) => {
                    acc[name] = getComputedStyle(document.documentElement).getPropertyValue(name);
                    return acc;
                }, {})
            }
        }
    );

    vscode.postMessage(
        {
            id: "fetchStatsData",
            data: {
                date: selectedDate
            }
        }
    );

    setTimeout(() => {
        appSplashSreenEl.style.display = "none";
    }, 2500);

    window.addEventListener("resize", resizeCanvas);
});

document.addEventListener("click", (event) => {
    if (event.target.matches("button.restoreBackupBtn")) {
        vscode.postMessage(
            {
                id: "restoreBackup",
                data: {
                    backupName: event.target.parentElement.getAttribute("data-backup-file-name")
                }
            }
        );
    };
});

reloadBtnEl.addEventListener("click", () => {
    vscode.postMessage(
        {
            id: "fetchStatsData",
            data: {
                date: selectedDate
            }
        }
    );
});

dateBtnEl.addEventListener("click", () => {
    renderCalendar(datePickerDate);
    dialogBoxContainerEl.classList.toggle("visibleEl");
    datePickerMenuEl.classList.toggle("visibleElAnimScale");
    openMenuName = "datePicker";
});

previousMonthBtnEl.addEventListener("click", () => {
    datePickerDate.setMonth(datePickerDate.getMonth() - 1);
    renderCalendar(datePickerDate);
});

nextMonthBtnEl.addEventListener("click", () => {
    datePickerDate.setMonth(datePickerDate.getMonth() + 1);
    renderCalendar(datePickerDate);
});

yearInputEl.addEventListener("change", (event) => {
    datePickerDate.setFullYear(parseInt(event.target.value, 10));
    renderCalendar(datePickerDate);
});

cancelDatePickerBtnEl.addEventListener("click", () => {
    dialogBoxContainerEl.classList.toggle("visibleEl");
    document.querySelector(`#${openMenuName}Menu`).classList.toggle("visibleElAnimScale");
});

thisWeekBtnEl.addEventListener("click", () => {
    datePickerDate = new Date();
    selectedDate = new Date();

    vscode.postMessage(
        {
            id: "fetchStatsData",
            data: {
                date: selectedDate
            }
        }
    );

    renderCalendar(datePickerDate);

    setTimeout(() => {
        cancelDatePickerBtnEl.click();
    }, 125);
});

settingsBtnEl.addEventListener("click", () => {
    vscode.postMessage(
        {
            id: "getAllSettings"
        }
    );

    
    setTimeout(() => {
        themeSelectInputElArray.forEach(input => {
            input.setAttribute("data-current-theme", "false");
        });

        bodyEl.querySelector(`[data-theme="${extensionSettingsObj.theme.toLowerCase()}"]`).setAttribute("data-current-theme", "true");

        if (extensionSettingsObj.notifications === true) {
            enableNotificationsSettingToggleSwitchEl.classList.add("on");
        } else {
            enableNotificationsSettingToggleSwitchEl.classList.remove("on");
        };
    
        if (extensionSettingsObj.backups === true) {
            enableBackupsSettingToggleSwitchEl.classList.add("on");
        } else {
            enableBackupsSettingToggleSwitchEl.classList.remove("on");
        };
    }, 500);

    dialogBoxContainerEl.classList.toggle("visibleEl");
    settingsMenuEl.classList.toggle("visibleElAnimScale");
    openMenuName = "settings";
});

closeMenuBtnElArray.forEach(btn => {
    btn.addEventListener("click", () => {
        dialogBoxContainerEl.classList.toggle("visibleEl");
        document.querySelector(`#${openMenuName}Menu`).classList.toggle("visibleElAnimScale");
    });
});

themeSelectInputElArray.forEach(input => {
    input.addEventListener("click", () => {
        const selectedTheme = input.getAttribute("data-theme");

        themeSelectInputElArray.forEach(input => {
            input.setAttribute("data-current-theme", "false");
        });

        if (selectedTheme === "light") {
            vscode.postMessage(
                {
                    id: "setSetting",
                    data: {
                        settingName: "theme",
                        settingValue: "Light"
                    }
                }
            );
        } else if (selectedTheme === "dark") {
            vscode.postMessage(
                {
                    id: "setSetting",
                    data: {
                        settingName: "theme",
                        settingValue: "Dark"
                    }
                }
            );
        };
        
        bodyEl.setAttribute("data-current-theme", selectedTheme);
        input.setAttribute("data-current-theme", "true");

        appSplashSreenEl.style.display = "flex";
        settingsMenuEl.querySelector("button.closeMenuBtn").click();

        setTimeout(() => {
            appSplashSreenEl.style.display = "none";
        }, 2500);
    });
});

toggleSwitchElArray.forEach(toggleSwitch => {
    toggleSwitch.addEventListener("click", () => {
        toggleSwitch.classList.toggle("on");
    });
});

enableNotificationsSettingToggleSwitchEl.addEventListener("click", () => {
    let settingStatus = false;

    if (enableNotificationsSettingToggleSwitchEl.classList.contains("on") === true) {
        settingStatus = true;
    };

    vscode.postMessage(
        {
            id: "setSetting",
            data: {
                settingName: "notifications",
                settingValue: settingStatus
            }
        }
    );
});

enableBackupsSettingToggleSwitchEl.addEventListener("click", () => {
    let settingStatus = false;

    if (enableBackupsSettingToggleSwitchEl.classList.contains("on") === true) {
        settingStatus = true;
    };

    vscode.postMessage(
        {
            id: "setSetting",
            data: {
                settingName: "backups",
                settingValue: settingStatus
            }
        }
    );
});

accountBtnEl.addEventListener("click", () => {
    dialogBoxContainerEl.classList.toggle("visibleEl");
    accountMenuEl.classList.toggle("visibleElAnimScale");
    openMenuName = "account";
});

importStatsBtnEl.addEventListener("click", () => {
    vscode.postMessage(
        {
            id: "importStats"
        }
    );
});

exportStatsBtnEl.addEventListener("click", () => {
    vscode.postMessage(
        {
            id: "exportStats"
        }
    );
});

displayBackupsBtnEl.addEventListener("click", () => {
    document.querySelector(`#${openMenuName}Menu`).classList.toggle("visibleElAnimScale");

    backupsMenuEl.classList.toggle("visibleElAnimScale");
    openMenuName = "backups";

    vscode.postMessage(
        {
            id: "fetchBackups"
        }
    );
});

resetStatsBtnEl.addEventListener("click", () => {
    vscode.postMessage(
        {
            id: "resetStats"
        }
    );
});

window.addEventListener("message", async (event) => {
    const messageObj = event.data;

    if (messageObj.id === "getAllSettings") {
        extensionSettingsObj = messageObj.data.settingsObj;
    };

    if (messageObj.id === "getSetting" || messageObj.id === "setSetting") {
        extensionSettingsObj[messageObj.data.settingName] = messageObj.data.settingValue;
    };

    if (messageObj.id === "genWcoUrls") {
        wcoConfig.urls = {};

        wcoConfig.urls.wco = messageObj.data.wco;
        wcoConfig.urls.schemas = messageObj.data.schemas;
    };

    if (messageObj.id === "fetchStatsData") {
        if (chartInstance != null) {
            chartInstance.destroy();
        };

        totalTimeModuleTextEl.innerText = formatTime(messageObj.data.totalTime);

        todayTimeModuleTextEl.innerText = formatTime(messageObj.data.todayTime);
        
        const last30DaysTimeAverage = messageObj.data.last30DaysStats.time / messageObj.data.last30DaysStats.numberOfActiveDays;
        const todayTimeModuleProgressChartCompletionRate = Math.min(parseInt(((messageObj.data.todayTime / last30DaysTimeAverage) * 100).toFixed(0)), 100);
        todayTimeModuleChartTextEl.innerText = `${todayTimeModuleProgressChartCompletionRate}%`;
        todayTimeModuleProgressChartPathEl.style.strokeDasharray = `${todayTimeModuleProgressChartCompletionRate}, 100`;

        if (todayTimeModuleProgressChartCompletionRate >= 75) {
            todayTimeModuleProgressChartPathEl.style.stroke = "rgba(var(--greenLevelColor4), 1)";
        } else if (todayTimeModuleProgressChartCompletionRate >= 50) {
            todayTimeModuleProgressChartPathEl.style.stroke = "rgba(var(--greenLevelColor3), 1)";
        } else if (todayTimeModuleProgressChartCompletionRate >= 25) {
            todayTimeModuleProgressChartPathEl.style.stroke = "rgba(var(--greenLevelColor2), 1)";
        } else {
            todayTimeModuleProgressChartPathEl.style.stroke = "rgba(var(--greenLevelColor1), 1)";
        };

        weekStreakModuleChartTextEl.innerText = messageObj.data.fullWeeks;

        for (let i = 0; i < 7; i += 1) {
            const dayTime = messageObj.data.weekArray[i].time;
            const dayEl = weekStreakModuleStreakGrid[i];

            if (dayTime >= 28800) {
                dayEl.style.backgroundColor = "rgba(var(--greenLevelColor4), 1)";
            } else if (dayTime >= 14400) {
                dayEl.style.backgroundColor = "rgba(var(--greenLevelColor3), 1)";
            } else if (dayTime >= 7200) {
                dayEl.style.backgroundColor = "rgba(var(--greenLevelColor2), 1)";
            } else if (dayTime > 0) {
                dayEl.style.backgroundColor = "rgba(var(--greenLevelColor1), 1)";
            } else {
                dayEl.style.backgroundColor = "transparent";
                dayEl.style.borderColor = "rgba(var(--borderColor), 1)";
            };
        };

        const currentYear = new Date().getFullYear();
        const lastDayOfYear = new Date(currentYear, 11, 31);
        const lastThursdayOfYear = new Date(lastDayOfYear);
        lastThursdayOfYear.setDate(lastDayOfYear.getDate() - ((lastDayOfYear.getDay() + 6) % 7) + 3);
        const weekInYear = Math.round((lastThursdayOfYear.getTime() - new Date(currentYear, 0, 4).getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
        const weekStreakModuleProgressChartCompletionRate = (messageObj.data.fullWeeks / weekInYear) * 100;
        weekStreakModuleProgressChartPathEl.style.strokeDasharray = `${weekStreakModuleProgressChartCompletionRate}, 100`;

        if (weekStreakModuleProgressChartCompletionRate >= 75) {
            weekStreakModuleProgressChartPathEl.style.stroke = "rgba(var(--greenLevelColor4), 1)";
        } else if (weekStreakModuleProgressChartCompletionRate >= 50) {
            weekStreakModuleProgressChartPathEl.style.stroke = "rgba(var(--greenLevelColor3), 1)";
        } else if (weekStreakModuleProgressChartCompletionRate >= 25) {
            weekStreakModuleProgressChartPathEl.style.stroke = "rgba(var(--greenLevelColor2), 1)";
        } else {
            weekStreakModuleProgressChartPathEl.style.stroke = "rgba(var(--greenLevelColor1), 1)";
        };

        weekChartModuleHeaderRangeDateEl.innerText = `${messageObj.data.weekArray[0].date.toString().substring(4, 6)}/${messageObj.data.weekArray[0].date.toString().substring(6, 8)}/${messageObj.data.weekArray[0].date.toString().substring(0, 4)} to ${messageObj.data.weekArray[6].date.toString().substring(4, 6)}/${messageObj.data.weekArray[6].date.toString().substring(6, 8)}/${messageObj.data.weekArray[6].date.toString().substring(0, 4)}`;

        const ctx = canvasEl.getContext("2d");

        const gradientObj = ctx.createLinearGradient(0, canvasEl.offsetHeight, 0, 0);
        gradientObj.addColorStop(0, "rgba(0, 0, 0, 0)");
        gradientObj.addColorStop(0.25, `rgba(${messageObj.data.chartConfig.customData.colorVariablesObj["--greenLevelColor1"]}, 0.175)`);
        gradientObj.addColorStop(0.5, `rgba(${messageObj.data.chartConfig.customData.colorVariablesObj["--greenLevelColor2"]}, 0.25)`);
        gradientObj.addColorStop(0.75, `rgba(${messageObj.data.chartConfig.customData.colorVariablesObj["--greenLevelColor3"]}, 0.325)`);
        gradientObj.addColorStop(1, `rgba(${messageObj.data.chartConfig.customData.colorVariablesObj["--greenLevelColor4"]}, 0.5)`);
        messageObj.data.chartConfig.data.datasets[0].backgroundColor = gradientObj;
        
        messageObj.data.chartConfig.options.plugins.tooltip.callbacks = {
            title: (context) => {
                const weekDayMap = {
                    "Monday": 0,
                    "Tuesday": 1,
                    "Wednesday": 2,
                    "Thursday": 3,
                    "Friday": 4,
                    "Saturday": 5,
                    "Sunday": 6
                };

                const dateNumberStr = messageObj.data.weekArray[weekDayMap[context[0].label]].date.toString();
               
                return `${context[0].label}   (${dateNumberStr.substring(4, 6)}-${dateNumberStr.substring(6, 8)}-${dateNumberStr.substring(0, 4)})`;
            },
            label: (context) => {
                if (Math.floor(context.parsed.y) <= 0) {
                    return `${Math.round((context.parsed.y - Math.floor(context.parsed.y)) * 60)}min`;
                } else {
                    return `${Math.floor(context.parsed.y)}h ${Math.round((context.parsed.y - Math.floor(context.parsed.y)) * 60)}min`;
                };
            },
            labelColor: (context) => {
                return {
                    borderColor: context.dataset.borderColor
                };
            },
            labelPointStyle: (context) => {
                return {
                    pointStyle: "line",
                    rotation: 0
                };
            }
        };

        chartInstance = new Chart(ctx, messageObj.data.chartConfig);
        
        resizeCanvas();

        if (messageObj.data.topProgrammingLanguagesArray.length >= 6) {
            globalStatsModuleElArray[0].querySelector("div.moduleLocked").style.display = "none";
            globalStatsModuleElArray[0].querySelector("div.globalStatsModuleBody").style.display = "flex";

            globalStatsModuleElArray[0].querySelectorAll("div.barChartInfo[data-language-rank]").forEach(el => {
                const rank = parseInt(el.getAttribute("data-language-rank"), 10);
                const languageData = messageObj.data.topProgrammingLanguagesArray[rank - 1];
                el.querySelector("span.infoName").textContent = languageData.extension;
                el.querySelector("span.infoValue").textContent = `${((languageData.time / messageObj.data.totalTime) * 100).toFixed(1)} %`;
            });
    
            globalStatsModuleElArray[0].querySelectorAll("div.barChart.languages div").forEach((bar, index) => {
                const infoValue = globalStatsModuleElArray[0].querySelector(`div.barChartInfo[data-language-rank=\"${index + 1}\"] > span.infoValue`).innerText;
                const percent = parseFloat(infoValue.replace("%", ""));
                bar.style.width = `${percent}%`;
            });
        };

        if (messageObj.data.topProjectsArray.length >= 6) {
            globalStatsModuleElArray[1].querySelector("div.moduleLocked").style.display = "none";
            globalStatsModuleElArray[1].querySelector("div.globalStatsModuleBody").style.display = "flex";

            globalStatsModuleElArray[1].querySelectorAll("div.barChartInfo[data-project-rank]").forEach(el => {
                const rank = parseInt(el.getAttribute("data-project-rank"), 10);
                const projectData = messageObj.data.topProjectsArray[rank - 1];
                el.querySelector("span.infoName").textContent = projectData.name;
                el.querySelector("span.infoValue").textContent = `${((projectData.time / messageObj.data.totalTime) * 100).toFixed(1)} %`;
            });
    
            globalStatsModuleElArray[1].querySelectorAll("div.barChart.projects div").forEach((bar, index) => {
                const infoValue = globalStatsModuleElArray[1].querySelector(`div.barChartInfo[data-project-rank=\"${index + 1}\"] > span.infoValue`).innerText;
                const percent = parseFloat(infoValue.replace("%", ""));
                bar.style.width = `${percent}%`;
            });
        };
    };

    if (messageObj.id === "importStatsStatus" || messageObj.id === "exportStatsStatus" || messageObj.id === "resetStatsStatus") {
        await newAlert(messageObj.data.type, accountMenuEl.querySelector("div.body"), messageObj.data.message);
    };

    if (messageObj.id === "fetchBackups") {
        const backupsArray = messageObj.data.backupsArray;

        const loaderComponentDataObj = {
            message: "Fetching backups..."
        };
        
        const loaderComponent = await wco.render(wcoConfig.urls.wco.loader, wcoConfig.urls.schemas.loader, loaderComponentDataObj);

        backupsMenuEl.querySelector("div.body > div:nth-of-type(1)").innerHTML = loaderComponent;

        setTimeout(async () => {
            if (backupsArray.length > 0) {
                let components = "";

                for (const backupObj of backupsArray) {
                    const backupComponentDataObj = {
                        fileName: `${backupObj.timestamp}_${backupObj.sizeb}.gz`,
                        date: new Date(parseInt(backupObj.timestamp, 10)).toLocaleDateString("en-US"),
                        size: parseFloat((parseInt(backupObj.sizeb, 10) / 1024).toFixed(1)),
                        unit: "KB"
                    };

                    const backupComponent = await wco.render(wcoConfig.urls.wco.backup, wcoConfig.urls.schemas.backup, backupComponentDataObj);

                    components += backupComponent;
                };
                
                backupsMenuEl.querySelector("div.body > div:nth-of-type(1)").innerHTML = components;
            } else {
                const noBackupComponent = await wco.render(wcoConfig.urls.wco.noBackup, wcoConfig.urls.schemas.noBackup, {});

                backupsMenuEl.querySelector("div.body > div:nth-of-type(1)").innerHTML = noBackupComponent;
            };
        }, 2500);
    };

    if (messageObj.id === "restoreBackupStatus") {
        await newAlert(messageObj.data.type, backupsMenuEl.querySelector("div.body"), messageObj.data.message);
    };
});