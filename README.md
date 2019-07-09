# amberdata-example-token-analysis
A set of scripts to understand core usage for a given address.

### How to use these scripts

Install the dependencies:

```
npm i
```

Set environmental variable to be your API key:

```
export AMBERDATA_API_KEY=YOUR_KEY_HERE
```
If you don't have an API Key yet, refer to [Obtaining an API Key](#) below.

## Scripts & Commands

```
# 1. Token Holder Summary:
$ npm run item1 -- <Token_Address>
$ npm run item1 -- 0xb8c77482e45f1f44de1745f52c74426c631bdd52

# 2. Holdings Over Time:
$ npm run item2 -- <Token_Address>
$ npm run item2 -- 0xb8c77482e45f1f44de1745f52c74426c631bdd52

# 3. Average Holdings: (2 parts)
$ npm run item3 -- <Token_Address>
$ npm run item3b -- <Token_Address> <Whale_Threshold>
$ npm run item3 -- 0xb8c77482e45f1f44de1745f52c74426c631bdd52
$ npm run item3b -- 0xb8c77482e45f1f44de1745f52c74426c631bdd52 1000000
```

## Example BNB Research:
Using Address: 0xb8c77482e45f1f44de1745f52c74426c631bdd52

#### 1. How many token holders do I have?
- Base URL: https://web3api.io/api/v1/addresses/:hash/information?includePrice=true
- This will return all the summary of a token, look at "numHolders" -- BNB has over 300k! This also shows helpful totals for Ether, token supply & price, trading info, etc.

Run the following code:
```
npm run item1 -- 0xb8c77482e45f1f44de1745f52c74426c631bdd52
```


#### 2. How has this changed over time?
- Base URL: https://web3api.io/api/v1/tokens/:hash/holders/historical?holderAddresses=0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be
- Get an array of individual holdings. Graph holdings with the current endpoint results.

Run the following code:
```
npm run item2 -- 0xb8c77482e45f1f44de1745f52c74426c631bdd52
```

#### 3. How many tokens does my average token holder have?
- Base URL 1: https://web3api.io/api/v1/tokens/:hash/holders/latest
- Base URL 2: https://web3api.io/api/v1/tokens/:hash/holders/historical?holderAddresses=
- Iterates over the holders, then does an average for each time period

Run the following code:
```
npm run item3 -- 0xb8c77482e45f1f44de1745f52c74426c631bdd52
npm run item3b -- 0xb8c77482e45f1f44de1745f52c74426c631bdd52 1000000
```

#### 4. How long do they hold my tokens?
- This would be a summation of #5, which requires iteration of all token holders

Run the following code:
```
TBD
```

#### 5. How are people using my token? HODLing? Or day trading?
- Base URL 1: https://web3api.io/api/v1/tokens/:hash/holders/historical?holderAddresses=
- Base URL 2: https://web3api.io/api/v1/addresses/:hash/token-transfers?tokenAddress=
- Adds the filter "tokenAddress", retrieves the transfers needed for understanding the timeframe of trades

Run the following code:
```
TBD
```

#### 6. What percentage of my token holders are whales (>1M in assets)?
- Base URL: https://web3api.io/api/v1/tokens/:hash/holders/latest
- Filters out by amount specified (in this example 18 decimals and thresholds specified)

Run the following code:
```
npm run item6 -- <Token_Address> <Whale_Threshold> <USD_Threshold>
npm run item6 -- 0xb8c77482e45f1f44de1745f52c74426c631bdd52 1000000 1000000
```

#### 6. What other tokens are my users holding?
- Base URL: https://web3api.io/api/v1/addresses/:hash/tokens
- Filters out by amount specified (in this example 18)
- NOTE: Takes a while for addresses with large amounts of holders, for a full percentage report. This also builds multiple reports with different filters allowing introspection against different validity parameters.

Run the following code:
```
npm run item7 -- <Token_Address> <Holdings_Threshold>
npm run item7 -- 0xb8c77482e45f1f44de1745f52c74426c631bdd52 5
```

## Resources

- [Contributing](./CONTRIBUTING.md)

## Licensing

This project is licensed under the [Apache Licence 2.0](./LICENSE).
