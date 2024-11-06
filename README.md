# pure-git-blame

A minimalist VSCode extension that focuses solely on Git blame functionality. View commit information right in your editor without any unnecessary features.

## Features

- 🎯 **Single Purpose**: Dedicated purely to git blame functionality
- 💡 **Line Attribution**: Shows author and commit date for selected lines
- 📝 **Detailed Information**: Hover over blame annotations to view complete commit details
- 🚀 **Lightweight**: No bloat, just the blame feature you need

## Installation

1. Clone the repository
2. Run the packaging command:
   ```bash
   pnpm package
   ```
3. In VSCode:
   - Open the Extensions view (`Ctrl+Shift+X` / `Cmd+Shift+X`)
   - Click on the "..." menu (More Actions)
   - Select "Install from VSIX..."
   - Navigate to and select the generated .vsix file

## Usage

1. Open any file in a Git repository
2. Execute the command "Toggle Git Blame" through:
   - Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) and search for "Toggle Git Blame"
   - Or set up your preferred keyboard shortcut

### Features in Detail

- **Line Attribution**: Once enabled, each line will display:
  - Author name
  - Commit date

- **Detailed View**: Hover over the blame annotation to see:
  - Complete commit message
  - Full commit hash
  - Author details
  - Timestamp

## Contributing

Feel free to submit issues and enhancement requests.

## License

[MIT License](LICENSE)