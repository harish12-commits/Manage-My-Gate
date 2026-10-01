const fs = require('fs')
const path = require('path')

function walk(dir) {
  let results = []
  const list = fs.readdirSync(dir)
  list.forEach(function (file) {
    file = path.join(dir, file)
    const stat = fs.statSync(file)
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file))
    } else {
      if (file.endsWith('.js') || file.endsWith('.jsx')) {
        let content = fs.readFileSync(file, 'utf8')
        let modified = false

        if (content.includes('bg-white')) {
          content = content.replace(/bg-white/g, 'bg-body')
          modified = true
        }
        if (content.includes('bg-light')) {
          content = content.replace(/bg-light/g, 'bg-body-secondary')
          modified = true
        }
        if (content.includes('text-dark')) {
          content = content.replace(/text-dark/g, 'text-body')
          modified = true
        }

        if (modified) {
          fs.writeFileSync(file, content, 'utf8')
          results.push(file)
        }
      }
    }
  })
  return results
}

const updated = walk('D:/atominos/GatedCommunity/frontend/src')
console.log('Updated files:', updated.length)
