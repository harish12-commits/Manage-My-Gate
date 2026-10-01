const fs = require('fs')
const path = require('path')

function walk(dir) {
  let results = []
  const list = fs.readdirSync(dir)
  list.forEach((file) => {
    file = path.join(dir, file)
    const stat = fs.statSync(file)
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file))
    } else if (file.endsWith('.js') || file.endsWith('.jsx')) {
      results.push(file)
    }
  })
  return results
}

const files = walk(path.join(__dirname, 'src'))

files.forEach((file) => {
  let content = fs.readFileSync(file, 'utf8')
  let changed = false

  content = content.replace(/from\s+['"]src\/(.*?)['"]/g, (match, p1) => {
    const targetPath = path.join(__dirname, 'src', p1)
    const relativePath = path.relative(path.dirname(file), targetPath).replace(/\\/g, '/')
    const finalPath = relativePath.startsWith('.') ? relativePath : './' + relativePath
    changed = true
    return `from '${finalPath}'`
  })

  if (changed) {
    fs.writeFileSync(file, content, 'utf8')
    console.log(`Updated ${file}`)
  }
})
