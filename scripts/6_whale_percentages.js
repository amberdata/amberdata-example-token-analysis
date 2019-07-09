const fs = require('fs')
const path = require('path')
const axios = require('axios')
const Big = require('big.js')
const moment = require('moment')
const BASE_URL = 'https://web3api.io/api/v1'

const AMBERDATA_API_KEY = process.env.AMBERDATA_API_KEY
if (!AMBERDATA_API_KEY) throw new Error('Missing AMBERDATA_API_KEY!')

const args = process.argv
const TOKEN_ADDRESS = args[2]
if (!TOKEN_ADDRESS) throw new Error('Missing TOKEN_ADDRESS!')

const THRESHOLD_USD = 1000000
const THRESHOLD_TOKENS = 1000000
let DECIMALS = 1e18

const options = {
  headers: {
    'x-api-key': AMBERDATA_API_KEY
  }
}

const getQueryFromObject = obj => {
  let q = ''

  for (const k in obj) {
    q += `${k}=${obj[k]}&`
  }

  return q ? `?${q}` : ''
}

// 1. Get price USD for token
const getPriceByHash = (hash, params) => {
  const query = getQueryFromObject(params)
  const url = `${BASE_URL}/addresses/${hash}/information${query}`

  return axios.get(url, options).then(res => {
    const d = res.data.payload
    if (d.decimals) DECIMALS = `1e${d.decimals}`
    return {
      priceUsd: new Big(d.unitValueUSD),
      totalValueUsd: new Big(d.totalValueUSD),
      totalSupply: new Big(d.totalSupply),
      numHolders: new Big(d.numHolders)
    }
  })
}

// 2. Get current holders & holdings
const getHoldersByHash = (hash, params) => {
  const query = getQueryFromObject(params)
  const url = `${BASE_URL}/tokens/${hash}/holders/latest${query}`

  return axios.get(url, options).then(res => {
    return res.data.payload.records
  })
}

const getAllData = async () => {
  const finalData = []

  const { priceUsd, totalValueUsd, totalSupply } = await getPriceByHash(TOKEN_ADDRESS, {})
  console.log('priceUsd', priceUsd.valueOf())
  let totalOtherTokens = totalSupply
  let totalOtherUsd = totalValueUsd

  const all = await getHoldersByHash(TOKEN_ADDRESS, { size: 1000 })

  // find data that meets the threshold
  all.forEach(a => {
    const item = { address: a.holderAddress }
    const tkns = new Big(a.numTokens)
    const amt = tkns.div(DECIMALS)
    const aUsd = amt.times(priceUsd)

    if (amt.gte(THRESHOLD_TOKENS)) {
      item.amountTokens = a.numTokens
      item.amountTokensPercent = amt.div(totalSupply).times(100)
      totalOtherTokens = totalOtherTokens.minus(amt)
    }
    if (aUsd.gte(THRESHOLD_USD)) {
      item.amountUsd = aUsd.valueOf()
      item.amountUsdPercent = aUsd.div(totalValueUsd).times(100)
      totalOtherUsd = totalOtherUsd.minus(aUsd)
    }
    if (item.amountTokens || item.amountUsd) {
      finalData.push(item)
    }
  })

  console.log('DONE', finalData.length)

  // Last, add the "Other" for comparisons
  const other = {
    amountTokens: totalOtherTokens.valueOf(),
    amountTokensPercent: totalOtherTokens.div(totalSupply).times(100).valueOf(),
    amountUsd: totalOtherUsd.valueOf(),
    amountUsdPercent: totalOtherUsd.div(totalValueUsd).times(100).valueOf()
  }
  console.log('other', other)
  finalData.push(other)

  // format and save output:
  const fileName = '6_whale_percentages'
  const outputDir = path.join(__dirname, '../output', TOKEN_ADDRESS)
  const templatePath = path.join(__dirname, '../templates', `${fileName}.html`)
  const templatePathOutput = path.join(outputDir, `${fileName}.html`)
  const dataOutputJson = path.join(outputDir, `${fileName}.json`)
  const outputData = JSON.stringify(finalData)

  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir)

  fs.writeFile(dataOutputJson, outputData, 'utf8', () => {
    console.log('updated dataOutputJson:', dataOutputJson)
  })

  // use the output and save into the template for easy viewing
  const file = await fs.readFileSync(templatePath)
  fs.writeFile(templatePathOutput, file.toString().replace('FULL_CHART_DATA', outputData), 'utf8', () => {
    console.log('updated example file:', templatePathOutput)
  })
}

getAllData()
