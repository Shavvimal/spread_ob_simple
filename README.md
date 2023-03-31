# Spread OB Problem

lets simplify the problem bro. Lets just try to get the Dynamic Filtering going like this:

Lets say we have 2 streams, ['active_spreads', 'assets'].

lets say 'assets stream' is just a string for simplicity, e.g lets use a random hex string as the value. The name is 'asset'. Lets enumerate the assets from A to E. Now each message will look like this:

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
