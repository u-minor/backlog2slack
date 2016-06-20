fs = require 'fs'
gulp = require 'gulp'
$ = require('gulp-load-plugins')()
argv = require('yargs').argv
yaml = require 'js-yaml'

aglexConfig = yaml.safeLoad fs.readFileSync("aglex-#{argv.env or 'development'}.yml", 'utf8')
aglex = require('aglex') aglexConfig, 'info'

sourceFiles = ['src/**/*.coffee']
watching = false

gulp.task 'build', ->
  runSequence = require 'run-sequence'

  runSequence 'clean', 'updateLambda'

gulp.task 'clean', (done) ->
  del = require 'del'

  del ['build/*', '!build/node_modules', 'dist/*'], done

gulp.task 'coffee', ->
  gulp.src 'src/**/*.coffee'
  .pipe $.coffee bare: true
  .pipe gulp.dest 'build'

gulp.task 'copyPackages', ->
  gulp.src './package.json'
  .pipe gulp.dest 'build'
  .pipe $.install production: true

gulp.task 'copyConfig', ->
  gulp.src "config/#{argv.env or 'development'}.yml"
  .pipe $.rename 'default.yml'
  .pipe gulp.dest 'build/config'

gulp.task 'zip', ['coffee', 'copyConfig', 'copyPackages'], ->
  gulp.src ['build/**', '!build/package.json']
  .pipe $.zip 'lambda.zip'
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

gulp.task 'listStages', (done) ->
  aglex.getApiStages().then (stages) ->
    for stage in stages
      console.log "#{stage.stageName}:#{stage.description or ''} (#{stage.invokeUrl})"
    done()
  return

gulp.task 'watch', ->
  watching = true
  gulp.watch sourceFiles, ['lint']

gulp.task 'lint', ->
  gulp.src sourceFiles
  .pipe $.coffeelint()
  .pipe $.coffeelint.reporter()
