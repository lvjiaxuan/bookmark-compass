# Bookmark Compass Privacy Policy

Bookmark Compass helps you save the current page to a suitable browser bookmark folder. This policy describes what the extension accesses and how it handles information.

## Data handled

When you open the extension, Bookmark Compass may process the following information in the browser:

- The active tab's title and URL.
- Selected metadata from the active page: description, keywords, and site name when those meta tags are present.
- The browser bookmark tree, so the extension can display folders and suggest a destination. Bookmark folder IDs, names, and paths may be included in a recommendation request. Bookmark page URLs are not sent to the recommendation model.
- The folder selected by you and the page title and URL needed to create the bookmark.

## Local AI processing

When available, Bookmark Compass uses the browser's built-in Prompt API and its local language model to recommend a bookmark folder. The page information and candidate folder information are passed to that browser-provided model through the browser API. The extension does not send this information to a developer-operated server.

The local AI feature is optional. You can choose a folder manually when the browser does not provide a supported local model or when you do not want to use the recommendation feature.

The model response is processed in memory and is used only to select a folder in the open extension panel.

## Data collection and sharing

Bookmark Compass does not:

- Collect analytics or telemetry.
- Sell, rent, or share personal information with advertisers or data brokers.
- Upload page content, bookmark data, or model responses to a developer-operated server.
- Use remote code or load executable code from a remote website.
- Store this information in an extension database, cookie, or cloud account.

The extension may create a bookmark only after you select or accept a destination and use the save action. The browser itself may handle bookmark data according to its own privacy policy.

## Permissions

- `bookmarks`: read the bookmark folder tree and create a bookmark in the folder selected by you.
- `activeTab`: read the title and URL of the tab on which you opened the extension.
- `scripting`: read the page's standard metadata tags to improve the recommendation. The extension does not read page body text.

## Retention and deletion

Bookmark Compass keeps recommendation inputs and results only in the active extension session. Closing the panel releases this in-memory data. The bookmark created by the save action remains in your browser until you delete it using the browser's bookmark controls.

## Changes to this policy

If the extension's data practices change, this policy will be updated before the changed behavior is released.

## Contact

For questions about this policy or Bookmark Compass, open an issue in the project repository:

https://github.com/lvjiaxuan/bookmark-compass/issues
