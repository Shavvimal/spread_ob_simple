import Kafka from "node-rdkafka";
import cluster from "cluster";
import os from "os";
import dotenv from "dotenv";
dotenv.config();

const numCPUs = os.cpus().length;
let quotes = ["USDT", "BUSD", "USDC"];
// we will be using one cpu core for active streams
// the remaining cores will be assigned a letter to dev up a channel name
let alphabet = "abcde".toUpperCase().split("");
// Generate random pairs
const generateAllPairs = () => {
  let pairs = [];
  for (let i = 0; i < alphabet.length; i++) {
    for (let j = 0; j < quotes.length; j++) {
      pairs.push(alphabet[i] + "-" + quotes[j]);
    }
  }
  return pairs;
};
// Only use the number of cores - 1 for the letter array (one is for active streams)
const letterArray = generateAllPairs().slice(0, numCPUs - 1);

if (cluster.isPrimary) {
  console.log(`!Master ${process.pid} Setup Report! CPU Number: ${numCPUs}`);
  console.log(`Ob Names:`, letterArray);
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }
  cluster.on("exit", (worker, code, signal) => {
    console.log(
      `worker ${worker.process.pid} died with code/signal ${
        signal || code
      }. Restarting worker...`
    );
    cluster.fork();
  });
} else {
  //  Config options can be found : https://github.com/confluentinc/librdkafka/blob/v2.0.2/CONFIGURATION.md
  const config = {
    "bootstrap.servers": process.env.BOOTSTRAP_SERVERS,
    "security.protocol": "SASL_SSL",
    "sasl.mechanisms": "PLAIN",
    "sasl.username": process.env.API_KEY,
    "sasl.password": process.env.API_SECRET,
    "session.timeout.ms": "45000",
    "group.id": process.env.GROUP_ID,
    "fetch.min.bytes": 1,
    "message.max.bytes": 1024 * 1024,
    "fetch.wait.max.ms": 100,
    "metadata.max.age.ms": 1,
  };

  const producer = new Kafka.Producer(config);

  let workerId = cluster.worker.id - 1;
  //  if worker id is 0, then we do active streams and assign the rest of the workers to the letter array
  if (workerId === 0) {
    var topic = process.env.TOPIC_ACTIVE;
    //  do active streams
    producer.connect();
    console.log(
      "Active Streams on Worker-" +
        workerId +
        " sending data to " +
        topic +
        "......"
    );

    let allSpreads = [];
    // Get all pairs of the letter array
    for (let i = 0; i < letterArray.length; i++) {
      for (let j = 0; j < letterArray.length; j++) {
        if (i !== j) {
          allSpreads.push(letterArray[i] + "_" + letterArray[j]);
        }
      }
    }

    const generateRandomTrigger = () => {
      // choose a random spread
      let randomIndex = Math.floor(Math.random() * allSpreads.length);
      let randomSpread = allSpreads[randomIndex];
      // choose randomly between true and false
      let randomTrigger = Math.random() >= 0.5;
      return {
        spread: randomSpread,
        assetone: randomSpread.split("_")[0],
        assettwo: randomSpread.split("_")[1],
        trigger: randomTrigger,
      };
    };

    producer.on("ready", () => {
      //  set interval to send data to kafka
      setInterval(() => {
        let randomTrigger = generateRandomTrigger();
        producer.produce(
          topic,
          -1,
          Buffer.from(JSON.stringify(randomTrigger)),
          Buffer.from(randomTrigger.spread)
        );
      }, 1000);
    });
  } else {
    //  OB stream
    var topic = process.env.TOPIC_OB;
    let worker_asset = letterArray[workerId - 1];
    let quote = worker_asset.split("-")[1];
    let base = worker_asset.split("-")[0];

    const generateRandomArray = (max, sort) => {
      // generate a random array of numbers from 1 to 101
      // length should be 10
      let arr = [];
      for (let i = 0; i < 10; i++) {
        arr.push(Math.floor(Math.random() * max) + 1);
      }
      // sort the array
      if (sort === true) {
        arr.sort((a, b) => a - b);
      }
      return arr;
    };
    const generateFakeOrderbook = () => {
      // Need to generate a fake orderbook for this asset
      const orderbook = {
        symbol: worker_asset,
        bid_size: generateRandomArray(10, false),
        bids: generateRandomArray(100, true),
        asks: generateRandomArray(100, true),
        ask_size: generateRandomArray(10, false),
        base: base,
        quote: quote,
      };
      return orderbook;
    };

    producer.connect();
    console.log(
      "OB Streams " +
        worker_asset +
        " on Worker-" +
        workerId +
        " sending data to " +
        topic +
        "......"
    );
    producer.on("ready", () => {
      //  set interval to send data to kafka
      let randomOrderbook = generateFakeOrderbook();
      setInterval(() => {
        producer.produce(
          topic,
          -1,
          Buffer.from(JSON.stringify(randomOrderbook)),
          Buffer.from(worker_asset)
        );
      }, 1000);
    });
  }
}
