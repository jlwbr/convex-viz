import http from "http";
import { join, dirname } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { promises as fs } from "fs";
import { WebSocketServer } from "ws";
import chokidar from "chokidar";
import open from "open";
import { existsSync } from "fs";

// CLI colors
const red = (msg: string) => `\x1b[31m${msg}\x1b[0m`;
const green = (msg: string) => `\x1b[32m${msg}\x1b[0m`;
const cyan = (msg: string) => `\x1b[36m${msg}\x1b[0m`;

// CLI usage/help
const usage = () => {
  console.log(`\n${cyan('convex-viz')} — Visualize your Convex schema as a Mermaid ER diagram\n`);
  console.log(`Usage: npx convex-viz [schema-file-path] [--print-diagram] [--help]\n`);
  console.log(`Options:`);
  console.log(`  schema-file-path   Path to your Convex schema file (default: convex/schema.ts)`);
  console.log(`  --print-diagram    Print the Mermaid diagram to stdout and exit`);
  console.log(`  --help             Show this help message\n`);
};

if (process.argv.includes('--help')) {
  usage();
  process.exit(0);
}

// Get schema file path from CLI arguments, or use default
let schemaFilePath = process.argv[2];
const printDiagramFlag = process.argv.includes("--print-diagram");
if (!schemaFilePath || schemaFilePath.startsWith("--")) {
  schemaFilePath = "convex/schema.ts";
}

// Check if schema file exists
if (!existsSync(schemaFilePath)) {
  console.error(red(`\nError: Schema file not found: ${schemaFilePath}\n`));
  usage();
  process.exit(1);
}

// __dirname equivalent in ESM
const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, "public");

// Helper to generate the Mermaid diagram from the schema
async function generateMermaidFromSchema(schemaFilePath: string): Promise<string> {
  try {
    // Use dynamic import with file URL for Node.js compatibility
    const schemaUrl = pathToFileURL(schemaFilePath).href + `?update=${Date.now()}`;
    const schemaModule = await import(schemaUrl);
    const schema = schemaModule.default;
    const tables = schema.tables;
    function getFieldType(validator: any): string {
      if (!validator) return "unknown";
      switch (validator.kind) {
        case "string": return "string";
        case "id": return `id(${validator.tableName})`;
        case "float64": return "number";
        case "int64": return "int";
        case "boolean": return "boolean";
        case "bytes": return "bytes";
        case "null": return "null";
        case "any": return "any";
        case "object": return "object";
        case "literal": return `${validator.value}`;
        case "array": return `${getFieldType(validator.element)}[]`;
        case "record": return `record(${getFieldType(validator.key)}_${getFieldType(validator.value)})`;
        case "union": return `union(${validator.members.map(getFieldType).join("_or_")})`;
        default: return validator.kind || "unknown";
      }
    }
    let mermaid = "erDiagram\n";
    const relationships: { from: string; to: string; field: string }[] = [];
    for (const [tableName, tableDef] of Object.entries(tables)) {
      mermaid += `${tableName.toUpperCase()} {\n`;
      const fields = (tableDef as any).validator.fields as Record<string, any> | undefined;
      if (fields) {
        for (const [fieldName, validator] of Object.entries(fields)) {
          const typeStr = getFieldType(validator);
          mermaid += `    ${typeStr} ${fieldName}\n`;
          if ((validator as any).kind === "id" && (validator as any).tableName) {
            relationships.push({
              from: tableName,
              to: (validator as any).tableName,
              field: fieldName,
            });
          }
        }
      }
      mermaid += `}\n`;
    }
    for (const rel of relationships) {
      mermaid += `${rel.to.toUpperCase()} ||--o{ ${rel.from.toUpperCase()} : ${rel.field}\n`;
    }
    return mermaid;
  } catch (err: any) {
    throw new Error(`Failed to load or parse schema: ${err.message || err}`);
  }
}

if (printDiagramFlag) {
  generateMermaidFromSchema(schemaFilePath).then((mermaid) => {
    console.log("\n--- Mermaid ER Diagram ---\n");
    console.log(mermaid);
    process.exit(0);
  }).catch((err) => {
    console.error(red(`\nError: ${err.message}\n`));
    process.exit(1);
  });
} else {
// Helper to serve static files from /public
async function serveStaticFile(path: string) {
  try {
    const filePath = join(PUBLIC_DIR, path);
    await fs.access(filePath);
    const ext = path.split(".").pop();
    const type =
      ext === "html" ? "text/html" :
      ext === "js" ? "application/javascript" :
      ext === "css" ? "text/css" :
      ext === "svg" ? "image/svg+xml" :
      "application/octet-stream";
    const data = await fs.readFile(filePath);
    return { data, type };
  } catch {
    return null;
  }
}

// Serve the frontend and schema JSON
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "", `http://${req.headers.host}`);
  if (url.pathname === "/schema") {
    const mermaid = await generateMermaidFromSchema(schemaFilePath);
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end(mermaid);
    return;
  } else if (url.pathname === "/ws-client.js") {
    // Serve the WebSocket client script
    res.writeHead(200, { "Content-Type": "application/javascript" });
    res.end(`
      const ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host);
      ws.onmessage = async (event) => {
        const mermaidText = event.data;
        const element = document.getElementById('diagram');
        element.innerHTML = '<div class="mermaid">' + mermaidText + '</div>';
        // For Mermaid v10+
        if (window.mermaid && window.mermaid.run) {
          await window.mermaid.run({ nodes: [element.querySelector('.mermaid')] });
        } else if (window.mermaid && window.mermaid.init) {
          // Fallback for older Mermaid
          window.mermaid.init(undefined, element.querySelector('.mermaid'));
        }
        setTimeout(() => {
          const svg = element.querySelector('svg');
          if (svg && window.svgPanZoom) {
            svg.style.width = '100vw';
            svg.style.height = '100vh';
            window.svgPanZoom(svg, {
              zoomEnabled: true,
              controlIconsEnabled: false,
              fit: true,
              center: true,
              minZoom: 0.2,
              maxZoom: 10,
              panEnabled: true,
              dblClickZoomEnabled: true,
              mouseWheelZoomEnabled: true,
            });
          }
        }, 100);
      };
    `);
    return;
  } else if (url.pathname === "/") {
    // Serve the main HTML file
    const filePath = join(PUBLIC_DIR, "index.html");
    try {
      await fs.access(filePath);
      const data = await fs.readFile(filePath);
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end("index.html not found");
    }
    return;
  } else {
    // Static file handler for /public assets
    const path = url.pathname.startsWith("/") ? url.pathname.slice(1) : url.pathname;
    if (!path) {
      res.writeHead(404);
      res.end("Not Found");
      return;
    }
    const staticResp = await serveStaticFile(path);
    if (staticResp) {
      res.writeHead(200, { "Content-Type": staticResp.type });
      res.end(staticResp.data);
      return;
    }
    res.writeHead(404);
    res.end("Not Found");
  }
});

// WebSocket server for live updates
const wss = new WebSocketServer({ server });

async function broadcastMermaid() {
  const mermaid = await generateMermaidFromSchema(schemaFilePath!);
  for (const client of wss.clients) {
    if (client.readyState === 1) { // OPEN
      client.send(mermaid);
    }
  }
}

// Watch the schema file for changes
chokidar.watch(schemaFilePath!).on('change', () => {
  broadcastMermaid();
});

wss.on('connection', (ws: import('ws').WebSocket) => {
  // Send the current diagram on connect
  generateMermaidFromSchema(schemaFilePath!).then((mermaid) => {
    if (ws.readyState === 1) ws.send(mermaid);
  });
});

const PORT = 3418;
server.listen(PORT, () => {
  console.log(green(`\nServer running at http://localhost:${PORT}`));
  console.log(cyan("Press Ctrl+C to stop.\n"));
  // Open the default browser to the server URL
  open(`http://localhost:${PORT}`);
});

process.on('SIGINT', () => {
  console.log(cyan("\nShutting down convex-viz. Goodbye!"));
  process.exit(0);
});
}