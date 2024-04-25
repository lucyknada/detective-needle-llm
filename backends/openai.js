const fetchRetry = async (url, options = {}) => {
  try {
    const res = await fetch(url, options)
    if (res.ok) return res
  } catch (_) { }
  return fetchRetry(url, options)
}

module.exports = {
  predict: async (input, template, model, endpoint, api_key, temperature = 1) => {
    const payload = {
      model,
      prompt: template.PROMPT.replace("{{{INPUT}}}", input),
      stream: false,
      temperature,
      max_tokens: 256,
      stop: template.STOP
    };

    let response = await fetchRetry(endpoint + "/v1/completions", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${api_key}`,
        "x-api-key": api_key,
      },
    });

    try {
      return (await response.json()).choices[0].text.trim();
    } catch (e) {
      console.log(e, await response.text());
    }
  }
}