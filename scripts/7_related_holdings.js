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

const TOKEN_HOLDING_THRESHOLD = args[3] ? parseInt(args[3], 10) : 5
const sizeTotal = 1000
let DECIMALS = 1e18
// Used in case we need to start at diff place in CSV
let HOLDER_START_INDEX = 1
let RETRY_INDEX = 0
const relatedMapUniques = new Map()
const relatedMapTradeableTokenUniques = new Map()
const relatedMapTradeableTokens = new Map()
const relatedMapTokens = new Map()
const relatedMapTokenMeta = new Map()


const csvName = '3_average_holdings'
const fileName = '7_related_holdings'
const outputDir = path.join(__dirname, '../output', TOKEN_ADDRESS)
const snapshotLastPoint = path.join(outputDir, `${fileName}_snapshot.json`)
const largeAddressCsv = path.join(outputDir, `large_unique_holdings_addresses.csv`)
const dataOutputCsv = path.join(outputDir, `${csvName}.csv`)
const sortedUniquesJson = path.join(outputDir, `${fileName}_uniques.json`)
const sortedTokensJson = path.join(outputDir, `${fileName}_tokens.json`)
const sortedTradableTokensJson = path.join(outputDir, `${fileName}_tradable_tokens.json`)
const sortedTradableTokenUniquesJson = path.join(outputDir, `${fileName}_tradable_uniques.json`)

// Check our source file exists first!
if (!fs.existsSync(dataOutputCsv)) {
  throw new Error(`Missing ${csvName} Data! Please run item 3 first!`)
}

const confirmFilesExist = async () => {
  if (!fs.existsSync(outputDir)) await fs.mkdirSync(outputDir)
  if (!fs.existsSync(sortedUniquesJson)) await fs.writeFile(sortedUniquesJson, JSON.stringify([]), 'utf8', () => {})
  if (!fs.existsSync(sortedTokensJson)) await fs.writeFile(sortedTokensJson, JSON.stringify([]), 'utf8', () => {})
  if (!fs.existsSync(sortedTradableTokensJson)) await fs.writeFile(sortedTradableTokensJson, JSON.stringify([]), 'utf8', () => {})
  if (!fs.existsSync(sortedTradableTokenUniquesJson)) await fs.writeFile(sortedTradableTokenUniquesJson, JSON.stringify([]), 'utf8', () => {})
  if (!fs.existsSync(snapshotLastPoint)) await fs.writeFile(snapshotLastPoint, JSON.stringify({key:1}), 'utf8', () => {})
  if (!fs.existsSync(largeAddressCsv)) await fs.writeFile(largeAddressCsv, '', 'utf8', () => {})
}

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


const sortFn = (a, b) => new Big(a[1]).minus(b[1])
const filterFn = a => new Big(a[1]).gt(TOKEN_HOLDING_THRESHOLD)
const getSortedAndFilteredData = arr => {
  return [...arr].sort(sortFn).filter(filterFn).reverse()
}
const getSortedAndFilteredDataWithMeta = arr => {
  return [...arr].sort(sortFn).filter(filterFn).reverse().map(p => {
    const m = relatedMapTokenMeta.get(p[0])
    return p.concat([m.name, m.symbol, m.decimals])
  })
}

// 1. Get related token holdings for address
const getRelatedTokensByHash = (hash, params) => {
  const query = getQueryFromObject(params)
  const url = `${BASE_URL}/addresses/${hash}/tokens${query}`
  // console.log('url', url)

  try {
    return axios.get(url, options).then(res => {
      return res.data.payload
    })
  } catch (e) {
    console.log('e', e)
    return {}
  }
}

const addLargeTokenHolderToList = async (address, total) => {
  let file = await fs.readFileSync(largeAddressCsv)
  file = file.toString() + `${address},${total}\n`
  await fs.writeFile(largeAddressCsv, file, 'utf8', () => {
    console.log('updated largeAddressCsv:', address)
  })
}

const saveStartFile = async key => {
  const data = JSON.stringify({ key })
  await fs.writeFile(snapshotLastPoint, data, 'utf8', () => {
    // console.log('updated snapshotLastPoint:', data)
  })
}

const loadStartFile = async () => {
  const file = await fs.readFileSync(snapshotLastPoint)
  try {
    const f = file.toString()
    if (!f || f.length <= 1) {
      HOLDER_START_INDEX = 1
      return
    }
    const d = JSON.parse(f)
    if (!d || !d.key) HOLDER_START_INDEX = 1
    else HOLDER_START_INDEX = d.key
    // console.log('HOLDER_START_INDEX', HOLDER_START_INDEX)
  } catch (e) {
    console.log('loadStartFile', e)
  }
}

const loadFileToMap = async (mapItem, filePath) => {
  let file = await fs.readFileSync(filePath)
  try {
    const f = file.toString()
    if (!f || f.length <= 1) return
    const fileData = JSON.parse(f)
    if (!fileData || fileData.length <= 1) return

    // loop through file and load into maps
    fileData.forEach(f => {
      mapItem.set(f[0], new Big(f[1]))
      relatedMapTokenMeta.set(f[0], { name: f[2], symbol: f[3], decimals: f[4] })
    })
  } catch (e) {
    console.log('loadFileToMap', e)
  }
}

const loadAllFiles = async () => {
  const paths = [
    { f: sortedUniquesJson, m: relatedMapUniques },
    { f: sortedTokensJson, m: relatedMapTokens },
    { f: sortedTradableTokensJson, m: relatedMapTradeableTokens },
    { f: sortedTradableTokenUniquesJson, m: relatedMapTradeableTokenUniques }
  ]

  await paths.forEach(async item => {
    await loadFileToMap(item.m, item.f)
  })
  console.log('-------------------------\n  LOADED FILES\n-------------------------\n')
}

const getAllData = async () => {
  // Open compiled file for averages, then get related token holdings
  const csvfile = await fs.readFileSync(dataOutputCsv)
  const records = csvfile.toString().split('\n')

  // Load previous starting point, if any
  await loadStartFile()
  console.log('HOLDER_START_INDEX', HOLDER_START_INDEX)

  // skip first line in CSV
  for (var i = HOLDER_START_INDEX; i < records.length; i++) {
    // for (var i = HOLDER_START_INDEX; i < 25; i++) {
    const item = records[i].split(',')
    const address = item[0]
    let allTokens
    // = await getRelatedTokensByHash(address, { size: sizeTotal, includePrice: true })

    try {
      allTokens = await getRelatedTokensByHash(address, { size: sizeTotal, includePrice: true })
      const t = allTokens && allTokens.totalRecords ? allTokens.totalRecords : allTokens.records.length
      const percentComplete = Math.round(i / records.length * 100)
      console.log(`Processing: ${address}, holding: ${t} - ${percentComplete}% ${i} / ${records.length}`)
    } catch (e) {
      saveStartFile(i)
      if (RETRY_INDEX > 3) return
      console.log('ATTEMPTING RETRY ----')
      RETRY_INDEX++
      getAllData()
    }
    saveStartFile(i)

    // if we have a large holder, need to keep track:
    if (parseInt(allTokens.totalRecords, 10) >= sizeTotal) await addLargeTokenHolderToList(address, allTokens.totalRecords)

    // iterate holdings, filter out base Token, tally the stuff
    allTokens.records.forEach(t => {
      if (t.address !== TOKEN_ADDRESS) {
        // unique total
        if (relatedMapUniques.has(t.address)) {
          relatedMapUniques.set(t.address, new Big(relatedMapUniques.get(t.address)).plus(1).valueOf())
        } else {
          relatedMapUniques.set(t.address, 1)
        }

        // tokens total
        if (relatedMapTokens.has(t.address)) {
          relatedMapTokens.set(t.address, new Big(relatedMapTokens.get(t.address)).plus(t.amount).toString())
        } else {
          relatedMapTokens.set(t.address, t.amount)
        }

        // only tradable tokens total
        if (t.price) {
          if (relatedMapTradeableTokenUniques.has(t.address)) {
            relatedMapTradeableTokenUniques.set(t.address, new Big(relatedMapTradeableTokenUniques.get(t.address)).plus(1).toString())
          } else {
            relatedMapTradeableTokenUniques.set(t.address, 1)
          }
          if (relatedMapTradeableTokens.has(t.address)) {
            relatedMapTradeableTokens.set(t.address, new Big(relatedMapTradeableTokens.get(t.address)).plus(t.amount).toString())
          } else {
            relatedMapTradeableTokens.set(t.address, t.amount)
          }
        }

        // track meta for display later
        // if (!relatedMapTokenMeta.has(t.address))
        relatedMapTokenMeta.set(t.address, t)
      }
    })

    // Save after every request, just to be safe
    // Sorted unique Token totals
    const sortedUniques = getSortedAndFilteredDataWithMeta(relatedMapUniques.entries())
    await fs.writeFile(sortedUniquesJson, JSON.stringify(sortedUniques), 'utf8', () => {
      // console.log('updated sortedUniquesJson:', sortedUniques.length)
    })

    // Sorted unique Token totals
    const sortedTokens = getSortedAndFilteredDataWithMeta(relatedMapTokens.entries())
    await fs.writeFile(sortedTokensJson, JSON.stringify(sortedTokens), 'utf8', () => {
      // console.log('updated sortedTokensJson:', sortedTokens.length)
    })

    // Sorted unique Token totals
    const sortedTradableTokens = getSortedAndFilteredDataWithMeta(relatedMapTradeableTokens.entries())
    await fs.writeFile(sortedTradableTokensJson, JSON.stringify(sortedTradableTokens), 'utf8', () => {
      // console.log('updated sortedTradableTokensJson:', sortedTradableTokens.length)
    })

    // Sorted Tradable Tokens
    const sortedTradableTokenUniques = getSortedAndFilteredDataWithMeta(relatedMapTradeableTokenUniques.entries())
    await fs.writeFile(sortedTradableTokenUniquesJson, JSON.stringify(sortedTradableTokenUniques), 'utf8', () => {
      // console.log('updated sortedTradableTokenUniquesJson:', sortedTradableTokenUniques.length)
    })
  }

  console.log('-------------------------------\n    DONE\n-------------------------------\n')
}

const main = async () => {
  await confirmFilesExist()
  await loadAllFiles()

  getAllData()
}

main()
