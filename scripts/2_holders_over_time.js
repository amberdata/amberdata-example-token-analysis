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

const range = 10 // days
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

// 1. Get circulating & total supply, unique holders, for a given range
const getHoldersForRangeByHash = (hash, params) => {
  const query = getQueryFromObject(params)
  const url = `${BASE_URL}/tokens/${hash}/supplies/historical${query}`

  return axios.get(url, options).then(res => {
    return res.data.payload.data
  })
}

// Get holder for a specific day:
const p = []
const now = +moment()
const startTimestamp = moment('2017-07-05T14:31:24.000Z').utc().valueOf()
const x = new moment()
const y = new moment(startTimestamp)
const duration = (moment.duration(x.diff(y))) / (24 * 60 * 60 * 1000)
const diffAmt = Math.floor(duration / 180)

let prevTimestamp = startTimestamp
for (var i = 0; i < diffAmt; i++) {
  const startDate = moment(prevTimestamp).add(0, 'days').utc().valueOf()
  let endDate = moment(prevTimestamp).add(179, 'days').utc().valueOf()
  if (startDate > now) break
  if (endDate > now) endDate = now

  p.push(getHoldersForRangeByHash(TOKEN_ADDRESS, { startDate, endDate }))
  prevTimestamp = endDate
}

const getAllData = async () => {
  const finalData = []

  const all = await Promise.all(p).then(ress => {
    return [].concat(...ress).sort((a, b) => a[0] > b[0])
  })

  all.forEach(a => finalData.push({
    date: a[0],
    holders: a[1],
    circulating: a[2],
    total: a[3]
  }))

  console.log('DONE', all.length)

  // format and save output:
  const outputDir = path.join(__dirname, '../output', TOKEN_ADDRESS)
  const templatePath = path.join(__dirname, '../templates', '2_holders_over_time.html')
  const templatePathOutput = path.join(outputDir, '2_holders_over_time.html')
  const dataOutputJson = path.join(outputDir, '2_holders_over_time.json')
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
