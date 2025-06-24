# convex-viz

Visualize your [Convex](https://convex.dev) database schema as an interactive [Mermaid](https://mermaid-js.github.io/) ER diagram! 

**convex-viz** is a CLI tool and live server that generates entity-relationship diagrams from your Convex schema, with live updates and static export options.

---

## Features
- 🖥️ **Live server**: View your schema as a Mermaid ER diagram in your browser, with automatic updates on schema changes.
- 🔄 **WebSocket updates**: Diagrams update instantly as you edit your schema file.
- 🖨️ **Static export**: Print the Mermaid diagram to your terminal for use in docs or other tools.
- 🛠️ **Easy CLI**: Run with `npx` or install globally.
- 📦 **NPM package**: Use as a CLI utility in any project.

---

## Installation

You can use convex-viz directly with `npx` (no install required):

```bash
npx convex-viz <schema-file-path> [--print-diagram]
```

Or install globally:

```bash
npm install -g convex-viz
```

---

## Usage

### Start the Live Server

```bash
npx convex-viz <schema-file-path>
```

- Opens a local server at [http://localhost:3418](http://localhost:3418)
- Edit your schema file and the diagram updates live in your browser!
- If no schema file is provided, defaults to `convex/schema.ts`.

### Print Mermaid Diagram to Terminal

```bash
npx convex-viz <schema-file-path> --print-diagram
```

- Outputs the Mermaid ER diagram text to your terminal.
- Great for copy-pasting into docs or Mermaid live editors.

### CLI Options

- `<schema-file-path>`: Path to your Convex schema file (default: `convex/schema.ts`)
- `--print-diagram`: Print the Mermaid diagram to stdout and exit (no server)
- `--help`: Show usage and options

---

## Example

```bash
npx convex-viz convex/schema.ts
```

Then open [http://localhost:3418](http://localhost:3418) to view your diagram.

---

## Development

Clone the repo and install dependencies:

```bash
npm install
```

Build the CLI:

```bash
npm run build
```

Run locally:

```bash
node dist/index.js <schema-file-path>
```

### TypeScript Schema Warning
- If you use a `.ts` schema file, Node.js v20+ may print an `ExperimentalWarning: Type Stripping is an experimental feature...` message.
- This warning is harmless and does not affect functionality.
- To hide it, you can run with `NODE_NO_WARNINGS=1`:
  ```bash
  NODE_NO_WARNINGS=1 npx convex-viz <schema-file-path>
  ```

---

## License

MIT

---

## Credits

- Built with [Convex](https://convex.dev), [Mermaid](https://mermaid-js.github.io/), and [ws](https://github.com/websockets/ws).
