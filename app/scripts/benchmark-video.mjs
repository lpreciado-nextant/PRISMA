import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { performance } from "node:perf_hooks";
import { mkdir, realpath, stat, writeFile } from "node:fs/promises";
import { resolve, join, basename, relative, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";

const [tools, sourcePath, outputPath, crfArgument = "23", preset = "fast"] = process.argv.slice(2);
if (!tools || !sourcePath || !outputPath) throw new Error("Usage: node scripts/benchmark-video.mjs <tools-directory> <source.mp4> <new-output-directory> [crf] [fast|medium|slow]");
const crf = Number(crfArgument);
if (!Number.isInteger(crf) || crf < 18 || crf > 28 || !["fast", "medium", "slow"].includes(preset)) throw new Error("Use CRF 18-28 and preset fast, medium or slow.");
const require = createRequire(join(resolve(tools), "package.json"));
const ffmpeg = require("ffmpeg-static");
const ffprobe = require("ffprobe-static").path;
const source = await realpath(sourcePath);
const output = resolve(outputPath);
const publicPath = fileURLToPath(new URL("../public/", import.meta.url));
const publicRelative = relative(publicPath, output);
if (!publicRelative || (!publicRelative.startsWith("..") && !isAbsolute(publicRelative))) throw new Error("Benchmark output must not be in public assets.");
await mkdir(output, { recursive: false });
const optimized = join(output, "optimized.mp4");
const run = (executable, args) => new Promise((accept, reject) => {
  const child = spawn(executable, args, { windowsHide: true });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", chunk => { stdout += chunk; });
  child.stderr.on("data", chunk => { stderr = (stderr + chunk).slice(-65536); });
  child.on("error", reject);
  child.on("close", code => code === 0 ? accept({ stdout, stderr }) : reject(new Error(`Video tool exited ${code}: ${stderr}`)));
});
const probe = async path => JSON.parse((await run(ffprobe, ["-v", "error", "-show_format", "-show_streams", "-of", "json", path])).stdout);
const original = await probe(source);
const video = original.streams.find(stream => stream.codec_type === "video");
if (!video || video.codec_name !== "h264") throw new Error("This benchmark expects an H.264 source.");
const started = performance.now();
await run(ffmpeg, ["-hide_banner", "-nostdin", "-nostats", "-n", "-threads", "2", "-i", source,
  "-map", "0:v:0", "-map", "0:a?", "-map", "0:s?", "-c:v", "libx264", "-preset", preset, "-crf", String(crf), "-threads", "2",
  "-pix_fmt", "yuv420p", "-c:a", "copy", "-c:s", "copy", "-map_metadata", "-1", "-movflags", "+faststart", optimized]);
const encodeMs = performance.now() - started;
const encoded = await probe(optimized);
const encodedVideo = encoded.streams.find(stream => stream.codec_type === "video");
for (const type of ["audio", "subtitle"]) {
  const before = original.streams.filter(stream => stream.codec_type === type);
  const after = encoded.streams.filter(stream => stream.codec_type === type);
  if (before.length !== after.length || before.some((stream, index) => stream.codec_name !== after[index].codec_name
    || (type === "audio" && stream.nb_frames !== after[index].nb_frames))) throw new Error(`${type} streams changed.`);
  if (type === "subtitle") for (let index = 0; index < before.length; index++) {
    const text = async path => (await run(ffmpeg, ["-v", "error", "-nostdin", "-i", path, "-map", `0:s:${index}`, "-f", "srt", "pipe:1"])).stdout;
    if (await text(source) !== await text(optimized)) throw new Error("Subtitle text or timing changed.");
  }
}
if (encodedVideo.width !== video.width || encodedVideo.height !== video.height
  || Math.abs(Number(encodedVideo.duration) - Number(video.duration)) > 0.1
  || encodedVideo.nb_frames !== video.nb_frames) throw new Error("Video geometry, duration or frame count changed.");
const quality = await run(ffmpeg, ["-hide_banner", "-nostdin", "-nostats", "-threads", "2", "-i", source,
  "-threads", "2", "-i", optimized, "-filter_complex_threads", "2",
  "-lavfi", "[0:v:0]setpts=PTS-STARTPTS[original];[1:v:0]setpts=PTS-STARTPTS[encoded];[original][encoded]ssim",
  "-an", "-f", "null", "-"]);
const ssim = Number(quality.stderr.match(/SSIM.*All:([\d.]+)/)?.[1]);
if (!Number.isFinite(ssim)) throw new Error("SSIM measurement missing.");
const sampleTime = String(Math.min(10, Number(video.duration) / 2));
await run(ffmpeg, ["-hide_banner", "-nostdin", "-nostats", "-n", "-ss", sampleTime, "-i", source,
  "-ss", sampleTime, "-i", optimized, "-filter_complex", "[0:v:0][1:v:0]hstack", "-frames:v", "1", "-q:v", "2", join(output, "comparison.jpg")]);
const sourceBytes = (await stat(source)).size;
const optimizedBytes = (await stat(optimized)).size;
const report = { source: basename(source), sourceBytes, optimizedBytes, reductionPercent: (1 - optimizedBytes / sourceBytes) * 100,
  encodeMs, ssim, width: video.width, height: video.height, durationSeconds: Number(video.duration), frames: Number(video.nb_frames),
  sourceVideoBitrate: Number(video.bit_rate), optimizedVideoBitrate: Number(encodedVideo.bit_rate),
  settings: { codec: "libx264", preset, crf, threads: 2, audio: "copy", subtitles: "copy", faststart: true },
  qualityCaveat: "SSIM and one frame comparison do not establish screen-text legibility or human quality acceptance." };
await writeFile(join(output, "report.json"), JSON.stringify(report, null, 2), { flag: "wx" });
console.log(JSON.stringify({ output, ...report }, null, 2));