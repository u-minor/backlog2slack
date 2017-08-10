'use strict'
const gulp = require('gulp')
const $ = require('gulp-load-plugins')()
const argv = require('yargs').argv
const env = argv.env || 'development'

const sourceFiles = ['src/**/*.js']

gulp.task('build', done =>
  require('run-sequence')('clean', 'zip', done)
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

gulp.task('preparePackages', () =>
  gulp.src(['./package.json', './yarn.lock'])
    .pipe(gulp.dest('build'))
    .pipe($.yarn({production: true}))
)

gulp.task('zip', ['prepareCode', 'preparePackages'], () =>
  gulp.src(['build/**', '!build/package.json', '!build/yarn.lock'])
    .pipe($.zip('lambda.zip'))
    .pipe(gulp.dest('dist'))
)
