# Spread OB Problem

lets simplify the problem bro. Lets just try to get the Dynamic Filtering going like this:

Lets say we have 2 streams, ['active_spreads', 'assets'].

lets say 'assets' stream is just a string for simplicity, e.g lets use a random hex string as the value. The name is 'asset'. Lets enumerate the assets from A to E. Now each message will look like this:

```json
{
  "asset": "A",
  "value": "0x1234567890abcdef"
}
```

This will be streaming for all assets. This is analogous to 'orderbooks' stream. Hex strings for all assets will be sent all the time at a rate of 1 per second.

The active spreads will be a stream of messages & triggers like this:

```json
{
  "spread": "A_B",
  "asset_1": "A",
  "asset_2": "B",
  "trigger": true
}
```

This will turn various spreads on and off. The spread value can take [A_B, A_C, A_D, A_E, B_C, B_D, B_E, C_D, C_E, D_E ....]. The trigger can be true or false. This is analogous to the 'active spreads' stream.

Lets try to get a CoFlatMapFunction() working with these two streams. Lets try and get an output stream that joins ONLY the active spreads individual asset strings like this:

If Spread "A_B" is true, and

```json
{
  "asset": "A",
  "value": "0x1234567890abcdef"
}
```

```json
{
  "asset": "B",
  "value": "0x1234567890abcdef"
}
```

We want to output this:

```json
{
  "spread": "A_B",
  "value": "A-0x1234567890abcdef-B-0x1234567890abcdef"
}
```

# Solution

The keyed state interfaces provides access to different types of state that are all scoped to the key of the current input element.

We will maintain, for every Key, a `MapState<UK, UV>` for active spreads and a `ValueState<T>` for the OB value.

There are now two scenarios:

1. We get an OB
   - We reference the `MapState` with the key of that Asset. On a KeyedStream, the `MapState<UK, UV>` keeps a list of mappings for that specific Key.
   - We first use `isEmpty()` to check whether this map contains any key-value mappings. If empty, do nothing. If not empty do 2 things:
     - Update the `ValueState<T>` OB value for this OB
     - Call `keys()` to get all the active opposite assets. We compute these spread OB's and emit.
2. We get an update from active streams
   - Key this stream by `asset_1`
   - add/remove `asset_2` from the `MapState<UK, UV>` for `asset_1`

# Resources

- [Dynamic Tables Flink](https://flink.apache.org/2017/03/30/continuous-queries-on-dynamic-tables/)
- [Working with State](https://nightlies.apache.org/flink/flink-docs-master/docs/dev/datastream/fault-tolerance/state/)

# Celery Solution

Celery: Distributed task queue
Celery allows you to define tasks and distribute them across multiple workers, and can handle task retries, timeouts, and prioritization.

With this setup, each Celery worker will subscribe to a specific order book and continuously compute the spread until it is told to stop. The workers will be automatically distributed across the ECS cluster, and the number of workers will be scaled up or down based on the workload. This helps ensure the system is scalable and fault-tolerant.

1. Create an ECS cluster and task definition for the Celery workers. The task definition includes a container image that has Celery and any necessary dependencies installed. See [here](https://github.com/tanchinhiong/decoupled-celery-example) for a model docker compose.
2. Set up a Redis server to store the order book data. The Celery workers will subscribe to this Redis server to receive updates on the order book.
3. Use Celery to define the task that the workers will execute i.e. which spreads.
   1. The task first connects to redis amd subscribes to the orderbooks in Redis that it needs for the spread it has been tasked with
   2. It uses the spread function to compute the spreads continuously by maintaining both OB's in memory.
   3. It emits the spread orderbook to the socket redis server. Use [this](https://pypi.org/project/socket.io-emitter/) package
4. Instantiate a PG lister in the Celery Broker to start / end tasks.
   - another option is to use the Celery API to submit the task to a Celery task queue.
   - Each task should include the necessary ob assets needed to subscribe to the correct order book in Redis.
5. Configure an ECS service to run the Celery workers. The service should be set up with service scaling to automatically scale the number of containers based on the number of tasks in the Celery task queue.
   - Will need custom metrics to create these scaling triggers, or we go with a simple CPU based scaling trigger.
6. Monitor the ECS cluster and task queue metrics to optimize resource utilization and identify any issues such as job timeouts or container failures.
7. Set up the UI such as Flower seen in [this article](https://medium.com/@tanchinhiong/separating-celery-application-and-worker-in-docker-containers-f70fedb1ba6d) to monitor the Celery workers and tasks.
