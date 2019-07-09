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

const addCommas = x => {
  if (!x) return 0
  const tmp = x.toString().split('.')
  tmp[0] = tmp[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return tmp.join('.')
}

const currencyNumber = v => {
  return new Big(v).toFixed(2).toString()
}

// 1. Get token information
const getInfoByHash = (hash, params) => {
  const query = getQueryFromObject(params)
  const url = `${BASE_URL}/addresses/${hash}/information${query}`

  return axios.get(url, options).then(res => {
    const d = res.data.payload
    if (d.decimals) DECIMALS = `1e${d.decimals}`
    return d
  })
}

const getAllData = async () => {
  const data = await getInfoByHash(TOKEN_ADDRESS, {})

  // format and save output:
  const fileName = '1_total_holders'
  const templatePath = path.join(__dirname, '../templates', `${fileName}.html`)
  const outputDir = path.join(__dirname, '../output', TOKEN_ADDRESS)
  const templatePathOutput = path.join(outputDir, `${fileName}.html`)
  const dataOutputJson = path.join(outputDir, `${fileName}.json`)
  const outputData = JSON.stringify(data)

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir)
  }

  fs.writeFile(dataOutputJson, outputData, 'utf8', () => {
    console.log('updated dataOutputJson:', dataOutputJson)
  })

  // use the output and save into the template for easy viewing
  let file = await fs.readFileSync(templatePath)
  file = file.toString()
    .replace('TOKEN_NAME', data.name)
    .replace('TOKEN_SYMBOL', data.symbol)
    .replace('TOKEN_ADDRESS', TOKEN_ADDRESS)
    .replace('TOTAL_HOLDERS', addCommas(data.numHolders))
    .replace('TOTAL_SUPPLY', addCommas(data.totalSupply))
    .replace('TOTAL_VALUE_USD', addCommas(currencyNumber(data.totalValueUSD)))
    .replace('TOTAL_PRICE_USD', addCommas(currencyNumber(data.unitValueUSD)))
  fs.writeFile(templatePathOutput, file, 'utf8', () => {
    console.log('updated example file:', templatePathOutput)
  })
}

getAllData()
