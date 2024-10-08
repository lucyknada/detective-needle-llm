const fs = require('fs');

const { predict } = require('./backends/openai.js');
const { insertString, trimText, generateRandomNeedle } = require('./util.js');
const { NEEDLE_ATTEMPTS, MODEL_NAME, ENDPOINTS, SHOW_FAILURES, NEEDLE_PREFIX, NEEDLE_QUESTION, TEMPLATE, CONCURRENCY, CONTEXT_LENGTH_START, NEEDLE_LENGTH, TEMPERATURE } = JSON.parse(fs.readFileSync("config.json", "utf-8"))

const ORIGINAL_INPUT_TEXT = fs.readFileSync("text.txt", "utf-8")
const NEEDLE_PREFIX_LENGTH = NEEDLE_PREFIX.length + 3
const NEEDLE_QUESTION_LENGTH = NEEDLE_QUESTION.length + 1
const RESPONSE_LENGTH_ALLOWED = 512

const FG_RED = "\x1b[31m"
const FG_GREEN = "\x1b[32m"
const FG_RESET = "\x1b[0m"

const template = {
  model: MODEL_NAME,
  needle_attempts: NEEDLE_ATTEMPTS,
  temperature: TEMPERATURE,
  results: {}
}

// https://stackoverflow.com/a/69219159
async function* raceAsyncIterators(asyncIterators) {
  async function nextResultWithItsIterator(iterator) {
    return { result: await iterator.next(), iterator: iterator };
  }
  const promises = new Map();
  for (const iterator of asyncIterators) {
    promises.set(iterator, nextResultWithItsIterator(iterator));
  }
  while (promises.size) {
    const { result, iterator } = await Promise.race(promises.values());
    if (result.done) {
      promises.delete(iterator);
    } else {
      promises.set(iterator, nextResultWithItsIterator(iterator));
      yield result.value;
    }
  }
}

// https://stackoverflow.com/a/69219159
async function* runTasks(maxConcurrency, taskIterator) {
  async function* createWorkerIterator() {
    for (const task of taskIterator) yield await task();
  }

  const asyncIterators = new Array(maxConcurrency);
  for (let i = 0; i < maxConcurrency; i++) {
    asyncIterators[i] = createWorkerIterator();
  }
  yield* raceAsyncIterators(asyncIterators);
}

!(async () => {
  fs.writeFileSync("failures.jsonl", "")

  let ENDPOINTS_INDEX = 0;
  let CONSECUTIVE_FAILS = 0;
  for (let context_length = CONTEXT_LENGTH_START; ; context_length += 1000) {
    if (CONSECUTIVE_FAILS > 10) {
      console.log("consecutive failures detected, exiting...")
      process.exit(0)
    }

    const queue = []
    for (let insertion_depth_i = 0; insertion_depth_i <= 100; insertion_depth_i += 10) {
      queue.push(async () => {
        const insertion_depth = Math.ceil((context_length / 100) * insertion_depth_i);
        const input_text = trimText(ORIGINAL_INPUT_TEXT, context_length - NEEDLE_PREFIX.length - NEEDLE_LENGTH - NEEDLE_QUESTION_LENGTH - RESPONSE_LENGTH_ALLOWED - NEEDLE_PREFIX_LENGTH);
        const insert_at_index = Math.max(trimText(input_text, Math.min(input_text.length, insertion_depth)).lastIndexOf('.') + 1, 0)

        let pass = 0;
        let fail = 0;
        const ENDPOINT = ENDPOINTS[ENDPOINTS_INDEX++ % ENDPOINTS.length]
        for (let needle_i = 0; needle_i < NEEDLE_ATTEMPTS; needle_i++) {
          const needle = generateRandomNeedle(NEEDLE_LENGTH)
          const insertedText = insertString(input_text, insert_at_index, `${NEEDLE_PREFIX} ${needle}. `)
          const response = await predict(insertedText + "\n" + NEEDLE_QUESTION, TEMPLATE, MODEL_NAME, ENDPOINT.URL, ENDPOINT.API_KEY, TEMPERATURE)
          if (response.toLowerCase().includes(needle.toLowerCase())) {
            pass++
          } else {
            fail++
            if (SHOW_FAILURES) console.log(`${FG_RED}`, response);
            fs.appendFileSync("failures.jsonl", JSON.stringify({ context: context_length, depth: insertion_depth, depth_percent: insertion_depth_i, needle: needle.toLowerCase(), failure: response.toLowerCase() }) + "\n")
          }
        }

        CONSECUTIVE_FAILS = (pass < fail ? CONSECUTIVE_FAILS + 1 : 0)

        template.results[context_length] = [...(template.results?.[context_length] || []), { pass, fail, insertion_depth: insertion_depth_i }]
        fs.writeFileSync("results.js", `const DATA = ${JSON.stringify(template)}`)
        return `${fail < pass ? FG_GREEN : FG_RED}context: ${context_length} \t depth: ${insertion_depth} (${insertion_depth_i}%) \t endpoint: ${ENDPOINT.URL}${FG_RESET}`
      })
    }

    for await (let value of runTasks(CONCURRENCY, queue.values())) {
      console.log(value);
    }
  }
})()
