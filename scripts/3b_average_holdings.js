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

const sizeTotal = 1000
let DECIMALS = 1e18
let COMPUTED_SUM = new Big(0)
let COMPUTED_AVERAGE = new Big(0)
const SHOW_WHALES = args[3] ? false : true
let WHALE_THRESHOLD = args[3] ? parseInt(args[3], 10) : 1000000
let TOTAL_HOLDERS = 0

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

const addCommas = x => {
  if (!x) return 0
  const tmp = x.toString().split('.')
  tmp[0] = tmp[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return tmp.join('.')
}

const currencyNumber = v => {
  return new Big(v).toFixed(2).toString()
}

// 1. Get price USD for token
const getPriceByHash = (hash, params) => {
  const query = getQueryFromObject(params)
  const url = `${BASE_URL}/addresses/${hash}/information${query}`

  return axios.get(url, options).then(res => {
    const d = res.data.payload
    if (d.decimals) DECIMALS = `1e${d.decimals}`
    return d
  })
}

const getAllData = async () => {
  const token = await getPriceByHash(TOKEN_ADDRESS, {})
  TOTAL_HOLDERS = token.numHolders
  console.log('numHolders', TOTAL_HOLDERS)

  // Open compiled file for averages, then calc average on total holders & sum of tokens
  const fileName = '3_average_holdings'
  const outputDir = path.join(__dirname, '../output', TOKEN_ADDRESS)
  const templatePath = path.join(__dirname, '../templates', `${fileName}.html`)
  const templatePathOutput = path.join(outputDir, `${fileName}.html`)
  const dataOutputCsv = path.join(outputDir, `${fileName}.csv`)
  const csvfile = await fs.readFileSync(dataOutputCsv)
  const records = csvfile.toString().split('\n')

  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir)

  // skip first line in CSV
  for (var i = 1; i < token.numHolders; i++) {
    if (!records[i]) break
    const item = records[i].split(',')
    const amt = new Big(item[1])
    if (SHOW_WHALES) {
      COMPUTED_SUM = COMPUTED_SUM.plus(new Big(item[1]))
    } else {
      if (amt.div(DECIMALS).lt(WHALE_THRESHOLD)) {
        COMPUTED_SUM = COMPUTED_SUM.plus(amt)
      } else {
        TOTAL_HOLDERS = TOTAL_HOLDERS - 1
      }
    }
  }

  const COMPUTED_AVERAGE = COMPUTED_SUM.div(TOTAL_HOLDERS).div(DECIMALS)
  const COMPUTED_AVERAGE_USD = new Big(token.unitValueUSD).times(COMPUTED_AVERAGE).toFixed(2).valueOf()
  console.log('COMPUTED_AVERAGE:', COMPUTED_AVERAGE.valueOf())
  console.log('Average USD:', COMPUTED_AVERAGE_USD)

  // use the output and save into the template for easy viewing
  let file = await fs.readFileSync(templatePath)
  file = file.toString()
    .replace('TOKEN_NAME', token.name)
    .replace('TOKEN_SYMBOL', token.symbol)
    .replace('TOKEN_ADDRESS', TOKEN_ADDRESS)
    .replace('TOTAL_HOLDERS', addCommas(TOTAL_HOLDERS))
    .replace('COMPUTED_AVERAGE', addCommas(COMPUTED_AVERAGE))
    .replace('COMPUTED_AVERAGE_USD', addCommas(COMPUTED_AVERAGE_USD))
    .replace('TOTAL_PRICE_USD', addCommas(currencyNumber(token.unitValueUSD)))
    .replace('SHOW_WHALES', SHOW_WHALES)
    .replace('WHALE_THRESHOLD', addCommas(WHALE_THRESHOLD))
  fs.writeFile(templatePathOutput, file, 'utf8', () => {
    console.log('updated example file:', templatePathOutput)
  })
}

getAllData()
