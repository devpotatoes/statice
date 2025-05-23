# Important notice about `.vsix` archives

`.vsix` files are archive packages used to manually install Visual Studio Code extensions. They are useful for offline installation or for accessing specific versions.

However, we strongly recommend not installing arbitrary versions of this extension via `.vsix` archives.

## Potential risks

Some older `.vsix` files may:

- Be outdated, lacking important features or recent bug fixes.

- Contain critical bugs that can lead to data corruption or loss.

- Introduce security vulnerabilities affecting your development environment.

Installing these versions can result in unstable behavior, data loss, or security issues.

## Recommended installation method

For the safest and most reliable experience:

> [!TIP]
> Always install and update this extension via the [Visual Studio Code marketplace](https://marketplace.visualstudio.com/items?itemName=devpotatoes.statice).

This guarantees:

- Access to the latest stable version.

- Automatic updates and fixes.

- Verified and safe release integrity

## Using `.vsix` archives offline

If you're installing this extension offline via a `.vsix` file, note that:

- Some features (like the dashboard) require external libraries such as `chart.js`.

- Without an internet connection, these features may not work correctly.

> [!NOTE]
> A future version of the extension will bundle necessary assets for full offline support.

Thank you for using Statice !
