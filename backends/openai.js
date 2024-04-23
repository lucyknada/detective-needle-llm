module.exports = {
  predict: async (input, template, model, endpoint, api_key) => {
    const payload = {
      model,
      prompt: template.PROMPT.replace("{{{INPUT}}}", input),
      stream: false,
      max_tokens: 512,
      stop: template.STOP
    };

    let response = await fetch(endpoint + "/v1/completions", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${api_key}`,
        "x-api-key": api_key,
      },
    });

    if (!response.ok) {
      console.log(response.status, await response.text());
      process.exit(0);
    }

    try {
      return (await response.json()).choices[0].text.trim();
    } catch (e) {
      console.log(e, await response.text());
    }
  }
}