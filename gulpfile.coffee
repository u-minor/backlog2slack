fs = require 'fs'
gulp = require 'gulp'
gutil = require 'gulp-util'
coffee = require 'gulp-coffee'
argv = require('yargs').argv
yaml = require 'js-yaml'

aglexConfig = yaml.safeLoad fs.readFileSync("aglex-#{argv.env or 'development'}.yml", 'utf8')
aglex = require('aglex') aglexConfig, 'info'

sourceFiles = ['src/**/*.coffee']
specFiles = ['test/**/*.spec.coffee']
watching = false

gulp.task 'build', ->
  runSequence = require 'run-sequence'

  runSequence 'clean', 'updateLambda'

gulp.task 'clean', (done) ->
  del = require 'del'

  del 'build', done
  return

gulp.task 'coffee', ->
  gulp.src 'src/**/*.coffee'
  .pipe coffee bare: true
  .pipe gulp.dest 'build'

gulp.task 'copyPackages', ->
  pkg = require './package.json'

  gulp.src "node_modules/@(#{Object.keys(pkg.dependencies).join '|'})/**"
  .pipe gulp.dest 'build/node_modules'

gulp.task 'copyConfig', ->
  rename = require 'gulp-rename'

  gulp.src "config/#{argv.env or 'development'}.yml"
  .pipe rename 'default.yml'
  .pipe gulp.dest 'build/config'

gulp.task 'zip', ['coffee', 'copyConfig', 'copyPackages'], ->
  zip = require 'gulp-zip'

  gulp.src 'build/**'
  .pipe zip 'lambda.zip'
  .pipe gulp.dest 'dist'

gulp.task 'updateLambda', ['zip'], (done) ->
  aglex.updateLambda('dist/lambda.zip').then ->
    done()
  return

gulp.task 'addLambdaPermission', (done) ->
  aglex.addLambdaPermission().then ->
    done()
  return

gulp.task 'updateApi', (done) ->
  aglex.updateApi().then ->
    done()
  return

gulp.task 'deployApi', (done) ->
  unless argv.stage
    console.log 'Please use --stage STAGENAME'
    return
  aglex.deployApi(argv.desc, argv.stage, argv.stagedesc).then ->
    done()
  return

gulp.task 'watch', ->
  watching = true
  gulp.watch sourceFiles, ['lint']
  gulp.watch specFiles, ['lint:test', 'test']

gulp.task 'lint', ->
  coffeelint = require 'gulp-coffeelint'

  gulp.src sourceFiles
  .pipe coffeelint()
  .pipe coffeelint.reporter()

gulp.task 'lint:test', ->
  coffeelint = require 'gulp-coffeelint'

  gulp.src specFiles
  .pipe coffeelint()
  .pipe coffeelint.reporter()

gulp.task 'coverage', ->
  istanbul = require 'gulp-coffee-istanbul'
  mocha = require 'gulp-mocha'

  gulp.src sourceFiles
  .pipe istanbul includeUntested: false
  .pipe istanbul.hookRequire()
  .on 'finish', ->
    gulp.src specFiles
    .pipe mocha
      reporter: 'spec'
    .on 'error', (err) ->
      gutil.log err.toString()
      if watching then this.emit 'end' else process.exit 1
    .pipe istanbul.writeReports
      dir: 'coverage'
      reporters: ['text', 'lcov']

gulp.task 'coverage:ci', ->
  istanbul = require 'gulp-coffee-istanbul'
  mocha = require 'gulp-mocha'

  gulp.src sourceFiles
  .pipe istanbul includeUntested: false
  .pipe istanbul.hookRequire()
  .on 'finish', ->
    fs = require 'fs'
    fs.mkdir 'reports', ->
      gulp.src specFiles
      .pipe mocha
        reporter: 'xunit'
        reporterOptions:
          output: 'reports/mocha.xml'
      .on 'error', (err) ->
        gutil.log err.toString()
        if watching then this.emit 'end' else process.exit 1
      .pipe istanbul.writeReports
        dir: 'coverage'
        reporters: ['text-summary', 'lcov', 'cobertura']

gulp.task 'test', ['coverage']
gulp.task 'test:ci', ['coverage:ci']
