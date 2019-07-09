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


const fileName = '3_average_holdings'
const outputDir = path.join(__dirname, '../output', TOKEN_ADDRESS)
const templatePath = path.join(__dirname, '../templates', `${fileName}.html`)
const templatePathOutput = path.join(outputDir, `${fileName}.html`)
const dataOutputCsv = path.join(outputDir, `${fileName}.csv`)

if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir)

const THRESHOLD_USD = 0
const THRESHOLD_TOKENS = 0
const sizeTotal = 1000
let DECIMALS = 1e18
let currentPage = 0
let priceUsd = 0
let totalValueUsd = 0
let totalSupply = 0

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

let continueToNextPage = true
const getPagedData = async page => {
  let finalData = ''
  // console.log('finalData', finalData)

  currentPage = page
  const all = await getHoldersByHash(TOKEN_ADDRESS, { size: sizeTotal, page: currentPage })
  console.log(`currentPage ${currentPage}, total records: ${all.length}`)
  if (all.length < sizeTotal) continueToNextPage = false

  // find data that meets the threshold
  all.forEach(a => {
    const item = { address: a.holderAddress }
    const tkns = new Big(a.numTokens)
    const amt = tkns.div(DECIMALS)
    const aUsd = amt.times(priceUsd)
    let str = `${a.holderAddress},`

    if (amt.gte(THRESHOLD_TOKENS)) {
      str += `${a.numTokens},${amt.div(totalSupply).times(100)},`
    } else {
      str += `,,`
    }
    if (aUsd.gte(THRESHOLD_USD)) {
      str += `${aUsd.valueOf()},${aUsd.div(totalValueUsd).times(100)}`
    } else {
      str += `,`
    }
    finalData += `${str}\n`
  })

  // format and save output:
  let file = page === 0 ? new Buffer.from('address,tokens,percent,usd,usd_percent\n') : await fs.readFileSync(dataOutputCsv)
  file = file.toString() + finalData
  await fs.writeFile(dataOutputCsv, file, 'utf8', () => {
    // console.log('updated dataOutputCsv:', dataOutputCsv)
    finalData = ''
  })
}

let pageIndex = 0
const getAllData = async (idx) => {
  if (idx === 0) {
    const info = await getPriceByHash(TOKEN_ADDRESS, {})
    priceUsd = info.priceUsd
    totalValueUsd = info.totalValueUsd
    totalSupply = info.totalSupply
    console.log('priceUsd', priceUsd.valueOf())
  }

  getPagedData(idx).then(() => {
    if (continueToNextPage && pageIndex < 350) {
      pageIndex++
      getAllData(pageIndex)
    }
  })
}

getAllData(pageIndex)
