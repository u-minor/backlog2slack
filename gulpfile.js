'use strict'
const fs = require('fs')
const gulp = require('gulp')
const $ = require('gulp-load-plugins')()
const argv = require('yargs').argv
const yaml = require('js-yaml')
const env = argv.env || 'development'

const aglex = (() => {
  try {
    const aglexConfig = yaml.safeLoad(fs.readFileSync(`aglex-${env}.yml`, 'utf8'))
    return require('aglex')(aglexConfig, 'info')
  } catch (e) {
  }
})()

const sourceFiles = ['src/**/*.js']

gulp.task('serve', () => {
  const server = $.liveServer('src/www.js', {
    env: {
      NODE_ENV: env
    }
  }, false)
  server.start()
  return gulp.watch(sourceFiles, () => {
    console.log('restart server')
    return server.start.bind(server)()
  })
})

gulp.task('build', () =>
  require('run-sequence')('clean', 'zip')
)

gulp.task('clean', done =>
  require('del')(['build/*', '!build/node_modules', 'dist/*'], done)
)

gulp.task('lint', () =>
  gulp.src(sourceFiles)
    .pipe($.eslint())
    .pipe($.eslint.format())
    .pipe($.eslint.failAfterError())
)

gulp.task('prepareCode', ['lint'], () =>
  gulp.src(sourceFiles)
    .pipe(gulp.dest('build'))
)

gulp.task('prepareConfig', () =>
  gulp.src(`config/${env}.yml`)
    .pipe($.rename('default.yml'))
    .pipe(gulp.dest('build/config'))
)

gulp.task('preparePackages', () =>
  gulp.src(['./package.json', './npm-shrinkwrap.json'])
    .pipe(gulp.dest('build'))
    .pipe($.install({production: true}))
)

gulp.task('zip', ['prepareCode', 'prepareConfig', 'preparePackages'], () =>
  gulp.src('build/**')
    .pipe($.zip('lambda.zip'))
    .pipe(gulp.dest('dist'))
)

gulp.task('updateLambda', ['zip'], done => {
  aglex.updateLambda('dist/lambda.zip')
    .then(() => done())
})

gulp.task('addLambdaPermission', done => {
  aglex.addLambdaPermission()
    .then(() => done())
})

gulp.task('updateApi', done => {
  aglex.updateApi()
    .then(() => done())
})

gulp.task('deployApi', done => {
  if (!argv.stage) {
    console.log('Please use --stage STAGENAME')
    return
  }
  aglex.deployApi(argv.desc, argv.stage, argv.stagedesc)
    .then(() => done())
})

gulp.task('listStages', done => {
  aglex.getApiStages()
    .then(stages => {
      for (let stage of stages) {
        console.log(`${stage.stageName}:${stage.description || ''} (${stage.invokeUrl})`)
      }
      done()
    })
})
