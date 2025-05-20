# Change Log

All notable changes to the "Statice" extension will be documented in this file.

## [Unreleased]

## [2.1.0] - 2025-05-20

### Changed

- The ./src/data/stats.json file has been moved to ./data/stats.json.

## [2.0.0] - 2025-05-20

### Added

- The code is now publicly available on GitHub.
- The bar chart modules now display the top 5 items.
- Added a new menu for data import, export, and reset.
- Data export feature added.
- Data import feature added.
- Added a button to reload data without needing to close the page.

### Changed

- Major codebase optimization for improved performance and readability.
- HTML, CSS, and JavaScript code are now separated into dedicated folders, no longer embedded in the extension.ts file.
- Enhanced security measures implemented across the application
- Complete redesign of the application interface.
- A new application icon has been introduced.
- The today code time module now only displays today's data, independent of the selected date.
- The today code time module now shows different data in the chart (refer to the README.md for more details).
- The week streaks module now only display the current week.
- The week streaks module chart now reflects the number of completed weeks in the current year.
- A new custom date input component has been implemented (replacing the default HTML input).
- A new settings menu has been added.
- Introduced new visual themes, dark and light, with Dark now set as the default.
- The time field in the data.json file is now expressed in seconds instead of minutes.
- The activity bar has been updated

### Removed

- The automatic theme switching feature has been removed.
- The green theme has been removed.

### Fixed

- Charts are now fully responsive.
- Fixed a hover issue when interacting with chart data.
- Added protection to prevent the app from displaying charts when the user has fewer than 5 languages or projects.

## [1.0.0] - 2024-04-08

- Initial release.