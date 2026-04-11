import type { Plugin, OutputBundle } from "rolldown";

interface BundleFile {
  fileName: string;
  size: number;
  type: "runtime" | "map";
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export function bundleSizeReporterPlugin(): Plugin {
  return {
    name: "bundle-size-reporter",

    writeBundle(outputOptions, bundle: OutputBundle) {
      const files: BundleFile[] = [];
      let runtimeSize = 0;
      let mapSize = 0;

      // Report JS files from the bundle (what Rolldown generated)
      for (const [fileName, chunk] of Object.entries(bundle)) {
        if (chunk.type === "chunk" || chunk.type === "asset") {
          const size = chunk.type === "chunk"
            ? Buffer.byteLength(chunk.code, "utf-8")
            : Buffer.byteLength(chunk.source);

          const type: BundleFile["type"] = fileName.endsWith(".js")
            ? "runtime"
            : "map";

          files.push({ fileName, size, type });

          if (type === "runtime") runtimeSize += size;
          if (type === "map") mapSize += size;
        }
      }

      // Sort files: runtime first, then maps
      const sortedFiles = files.sort((a, b) => {
        const order = { runtime: 0, map: 1 };
        return order[a.type] - order[b.type];
      });

      // Print report
      console.log("\n📦 Bundle Size Report");
      console.log("═".repeat(50));

      if (sortedFiles.length === 0) {
        console.log("No files to report.");
        return;
      }

      // Print file details
      for (const file of sortedFiles) {
        const icon = file.type === "runtime" ? "⚡" : "🗺️";
        const size = formatBytes(file.size).padStart(10);
        console.log(`${icon} ${file.fileName.padEnd(30)} ${size}`);
      }

      console.log("─".repeat(50));

      // Print summary
      console.log(`⚡ Runtime (JS):           ${formatBytes(runtimeSize).padStart(10)}`);
      console.log(`🗺️  Sourcemaps:             ${formatBytes(mapSize).padStart(10)}`);
      console.log("─".repeat(50));
      console.log(`📦 Total:                  ${formatBytes(runtimeSize + mapSize).padStart(10)}`);
      console.log("");
    },
  };
}
