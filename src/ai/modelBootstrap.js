// src/ai/modelBootstrap.js
export async function loadModelFromServer() {
  const url = process.env.REACT_APP_MODEL_URL;
  if (!url) {
    console.warn("MODEL_BOOTSTRAP: Missing REACT_APP_MODEL_URL");
    return null;
  }

  try {
    const res = await fetch(`${url}?model=1`);
    const data = await res.json();

    if (data?.ok && data?.model) {
      localStorage.setItem("LBQ_MODEL_JSON", JSON.stringify(data.model));
      console.log("MODEL_BOOTSTRAP: Model fetched and saved →", data.model);
      return data.model;
    } else {
      console.warn("MODEL_BOOTSTRAP: No valid model in response", data);
    }
  } catch (err) {
    console.error("MODEL_BOOTSTRAP: Fetch failed", err);
  }

  return null;
}