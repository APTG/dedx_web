const date = new Date().toLocaleDateString()

const cp = require('child_process')

const commit = cp
    .execSync('git rev-parse --short HEAD')
    .toString().trim()

const branch = cp
    .execSync('git describe --all')
    .toString().trim()

// skipcq: JS-0002

const command = `echo '${JSON.stringify({
    date,
    commit,
    branch
})}' > ${process.argv[2]}`

cp.execSync(command)
