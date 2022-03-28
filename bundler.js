// 1.分析模块
// (1).解析源代码成ast树
// (2).分析依赖
// (3).转换ast树代码为es5
// 2.分析依赖图谱
// 3.生成可执行code

const fs = require('fs')
const path = require('path')
// 解析源代码成ast树
const parser = require('@babel/parser')
// 便利ast树的插件
const traverse = require('@babel/traverse').default
// babel 核心模块
const babel = require('@babel/core')

const moduleAnalyser = (filename) => {
  // (1).解析源代码成ast树
  const content = fs.readFileSync(filename, 'utf-8')
  const ast = parser.parse(content, {
    sourceType: 'module'
  });

  // (2).分析依赖
  const dependencies = {}
  traverse(ast, {
    ImportDeclaration({ node }) {
      const dirname = path.dirname(filename)
      const newfile = './' + path.join(dirname, node.source.value)
      dependencies[node.source.value] = newfile
    }
  })

  // (3).转换ast树代码为es5
  const { code } = babel.transformFromAst(ast, null, {
    presets: ["@babel/preset-env"]
  });

  return {
    filename,
    dependencies,
    code
  }
}

// 2.分析依赖图谱
const makeDependenciesGraph = (entry) => {
  const entryModule = moduleAnalyser(entry)
  const graphArray = [entryModule]
  for (let i = 0; i < graphArray.length; i++) {
    const graphModule = graphArray[i]
    const { dependencies } = graphModule
    for (let j in dependencies) {
      graphArray.push(moduleAnalyser(dependencies[j]))
    }
  }

  const graph = {}
  graphArray.forEach(item => {
    graph[item.filename] = {
      dependencies: item.dependencies,
      code: item.code
    }
  })
  return graph
}

// 3.生成可执行code
const generateCode = (entry) => {
  const graph = JSON.stringify(makeDependenciesGraph(entry))
  return `
    (function(graph) {
      function require(module) {
        function localRequire(relativePath) {
          return require(graph[module].dependencies[relativePath])
        }
        var exports = {};
        (function(require, exports, code) {
          eval(code)
        })(localRequire, exports, graph[module].code)
        return exports
      };

      require('${entry}')
    })(${graph});
  `
}

const code = generateCode('./src/index.js')
console.log(code);
