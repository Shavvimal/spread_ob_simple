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
