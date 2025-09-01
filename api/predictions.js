// api/predictions.js
import axios from "axios";

function toArray(x) {
  return !x ? [] : Array.isArray(x) ? x : [x];
}

function normalizeLive(json) {
  const categories = toArray(json?.scores?.category);
  const out = [];
  for (const cat of categories) {
    const catName = cat?.["@name"] || "";
    const catId = cat?.["@id"] || "";
    const matches = toArray(cat?.match);
    for (const m of matches) {
      const players = toArray(m?.player).map((p) => ({
        id: p?.["@id"] || "",
        name: p?.["@name"] || "",
        s1: p?.["@s1"] ?? p?.s1 ?? null,
        s2: p?.["@s2"] ?? p?.s2 ?? null,
        s3: p?.["@s3"] ?? p?.s3 ?? null,
        s4: p?.["@s4"] ?? p?.s4 ?? null,
        s5: p?.["@s5"] ?? p?.s5 ?? null,
      }));
      out.push({
        id: m?.["@id"] || "",
        date: m?.["@date"] || "",
        time: m?.["@time"] || "",
        status: m?.["@status"] || "",
        categoryId: catId,
        categoryName: catName,
        players,
        prediction: {
          label: "PENDING",
          pick: null,
          confidence: 0,
          source: "fallback",
          detail: "set_pending",
        },
      });
    }
  }
  return out;
}

export default async function handler(req, res) {
  try {
    const token = process.env.GOALSERVE_TOKEN;
    if (!token) {
      return res.status(500).json({ error: "missing_token" });
    }

    const url = `https://www.goalserve.com/getfeed/${token}/tennis_scores/home?json=1`;

    const response = await axios.get(url, {
      timeout: 15000,
      headers: { "User-Agent": "livebetiq/1.0 (+vercel)" },
      decompress: true,
      validateStatus: (s) => s >= 200 && s < 500,
    });

    if (response.status >= 400) {
      return res
        .status(502)
        .json({ error: "upstream_error", status: response.status });
    }

    const raw = typeof response.data === "string" ? JSON.parse(response.data) : response.data;
    const matches = normalizeLive(raw);

    return res.status(200).json({ matches });
  } catch (err) {
    console.error("[/api/predictions] error:", err?.message || err);
    return res
      .status(500)
      .json({ error: "internal_error", detail: err?.message || "unknown" });
  }
}