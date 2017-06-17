const fs = require('fs-extra')
const argv = require('yargs').argv;
const path = require('path')
const chalk = require('chalk')
const untildify = require('untildify')
const globby = require('globby')
const ffmpeg = require('fluent-ffmpeg')
const moment = require('moment')
const _ = require('lodash')

//let outfile = argv.o || argv.outfile;
//let
// videoconvert *.mp4 -o output -f mkv

let sourceExt = (argv['_'][0] || 'mp4').replace('.', '')
let sourcePattern = `*.${sourceExt}`;
let format = 'mp4' // for now output is only mp4 ... //(argv.f || argv.format || '').replace('.','')
let targetExt = `.${format}`
let targetDir = (argv['_'][1] || argv.o || argv.output || argv.dir) || ('converted-files-' + Date.now())

let sourceDir = process.cwd()

console.log('')
console.log(chalk.cyan(' Converting video files:'))
console.log('')
console.log(chalk.white(` from '${chalk.magenta(sourceDir)}'`))
console.log(chalk.white(` to '${chalk.magenta(targetDir)}'`))
console.log('')

if (sourceDir.substr(0, 1) === '~') {
  sourceDir = untildify(sourceDir)
}

if (targetDir.substr(0, 1) === '~') {
  targetDir = untildify(targetDir)
}

fs.mkdirsSync(targetDir)

let files = globby.sync(sourcePattern, {cwd: sourceDir})

//files = ['VIDEO0080.mp4', 'VIDEO0100.mp4']

const time = () => chalk.grey(`[${moment().format('HH:mm:ss')}]`)

const promiseSerial = funcs =>
  funcs.reduce((promise, func) =>
      promise.then(result => func().then(Array.prototype.concat.bind(result))),
    Promise.resolve([]))

// convert each file to a function that returns a promise
const funcs = files.map(file => () => convertPromise(file))

// execute promises in serial
promiseSerial(funcs).then(() => {
  console.log(chalk.cyan(' Conversion succeeded.\n'))
}).catch((err) => {
  console.log(err.stack)
  console.log(err.trace)
  console.log(chalk.red(`\n An error occurred "${err.message}".`))
  console.log(chalk.red('\n Conversion failed.\n'))
})

function convertPromise(file) {
  const src = path.join(sourceDir, file)
  const destfile = path.basename(file, path.extname(file)) + '.' + targetExt.replace('.', '')
  const dest = path.join(targetDir, destfile)
  return new Promise(function (resolve, reject) {
    console.log(` ${time()} Converting '${chalk.magenta(file)}'...`)
    let prevPercent = 0
    ffmpeg(src)
      .format('mp4')
      .videoCodec('libx264')
      .videoBitrate('6144k')
      .audioCodec('aac')
      //.audioCodec('libmp3lame')
      //.size('320x240')
      //.size('10%x?')
      .outputOptions([
        '-preset:v veryfast',
        '-pass 1'
      ])
      .on('progress', function (progress) {
        let mod = 15
        let nearestPercent = Math.round(progress.percent / mod) * mod
        nearestPercent = Math.min(100, nearestPercent)
        if (nearestPercent % mod === 0 && nearestPercent !== prevPercent) {
          prevPercent = nearestPercent
          console.log(` ${time()} ${nearestPercent}%`)
        }
      })
      .on('error', reject)
      .on('end', () => {
        console.log(chalk.cyan(` ${time()} Finished.\n`))
        resolve()
      })
      .save(dest)
  });

}

