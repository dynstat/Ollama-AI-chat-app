import express from "express";
import cors from "cors";
import axios from "axios";

const app = express();
app.use(cors());
app.use(express.json());

// Forward request to Ollama running on host (host.docker.internal)
app.post("/chat", async (req, res) => {
  try {
    const response = await axios.post(
      "http://host.docker.internal:11434/api/generate", // host machine Ollama
      { model: "gpt-oss:20b", prompt: req.body.prompt },
      { responseType: "stream" }
    );
    response.data.pipe(res); // stream Ollama’s response back
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Error connecting to Ollama");
  }
});

app.listen(3001, () => console.log("Backend running on port 3001"));
