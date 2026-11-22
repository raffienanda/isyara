import { env, pipeline } from "./transformers.min.js";
env.allowRemoteModels = false;
env.allowLocalModels = true;
env.useBrowserCache = false;
env.localModelPath = new URL("./", import.meta.url).href;
env.backends.onnx.wasm.numThreads = 1;
env.backends.onnx.wasm.wasmPaths = new URL("./", import.meta.url).href;
let model;
self.onmessage = async ({ data }) => {
  try {
    model ??= await pipeline("automatic-speech-recognition", "whisper", {
      quantized: true,
    });
    if (!data.audio) {
      postMessage({ ready: true });
      return;
    }
    const out = await model(data.audio, {
      language: "indonesian",
      task: "transcribe",
      max_new_tokens: 80,
    });
    postMessage({ text: out.text.trim() });
  } catch (e) {
    postMessage({
      error:
        "Model suara belum siap. Periksa unduhan paket atau gunakan input teks.",
    });
  }
};
