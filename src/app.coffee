_ = require 'lodash'
Q = require 'q'
Slack = require 'slack-node'
config = require 'config'
express = require 'express'
request = require 'request'

slack = new Slack config.slack.apiToken

app = express()
app.use require('body-parser').json limit: '5mb'

types =
  1: '課題の追加'
  2: '課題の更新'
  3: '課題にコメント'
  4: '課題の削除'
  5: 'Wikiを追加'
  6: 'Wikiを更新'
  7: 'Wikiを削除'
  8: '共有ファイルを追加'
  9: '共有ファイルを更新'
  10: '共有ファイルを削除'
  11: 'Subversionコミット'
  12: 'GITプッシュ'
  13: 'GITリポジトリ作成'
  14: '課題をまとめて更新'
  15: 'プロジェクトに参加'
  16: 'プロジェクトから脱退'
  17: 'コメントにお知らせを追加'
  18: 'プルリクエストの追加'
  19: 'プルリクエストの更新'
  20: 'プルリクエストにコメント'

app.use '/notify', (req, res, next) ->
  bl = req.body

  blKey = "#{bl.project.projectKey}-#{bl.content.key_id}"
  console.log "Start #{blKey}"
  if bl.notifications.length is 0
    console.log 'Notification not found.'
    res.json message: 'OK'
    return

  Q.all [
    fetchBacklogUsers bl.project.projectKey
    do fetchSlackUsers
  ]
  .then (data) ->
    users = []
    for notification in bl.notifications
      continue unless blUser = _.find data[0], id: notification.user.id
      continue unless slUser = _.find data[1].members, (o) -> o.profile.email is blUser.mailAddress
      users.push slUser.name

    if users.length is 0
      console.log 'User not found.'
      res.json message: 'OK'
      return

    console.log "Start message post to #{users.join ','}"
    message = generateChatMessage bl
    postChatMessage message, users
    .then (data) ->
      res.json message: 'OK'
    , (err) ->
      res.status 404
        .json err

app.use (req, res, next) ->
  res.status 404
  .json error: 'Not Found'

app.use (err, req, res, next) ->
  console.error err.stack
  res.status 500
  .json error: 'Internal Server Error'

module.exports = app

fetchBacklogUsers = (projectKey) ->
  dfd = Q.defer()
  request "#{config.backlog.baseUrl}/api/v2/projects/#{projectKey}/users?apiKey=#{config.backlog.apiKey}", (err, response) ->
    if err
      dfd.reject err
    else
      dfd.resolve JSON.parse response.body
  dfd.promise

fetchSlackUsers = ->
  dfd = Q.defer()
  slack.api 'users.list', (err, response) ->
    if err
      dfd.reject err
    else
      dfd.resolve response
  dfd.promise

generateChatMessage = (backlogMessage) ->
  blKey = "#{backlogMessage.project.projectKey}-#{backlogMessage.content.key_id}"
  fields = []
  if backlogMessage.content.comment
    fields.push
      title: 'Comment'
      value: backlogMessage.content.comment.content.replace '\n', ' '
      short: false

  message =
    as_user: true
    attachments: JSON.stringify [
      fallback: "Backlog - #{types[backlogMessage.type]}: #{blKey} #{backlogMessage.content.summary}"
      text: "<#{config.backlog.baseUrl}/view/#{blKey}|#{blKey}> #{backlogMessage.content.summary}"
      pretext: "Backlog - #{types[backlogMessage.type]}"
      # color: color
      mrkdwn_in: ['pretext', 'text', 'fields']
      fields: fields
    ]
  message

postChatMessage = (message, users) ->
  promises = []

  for user in users
    payload = _.extend {}, message, channel: "@#{user}"

    console.log payload
    promises.push do ->
      dfd = Q.defer()
      slack.api 'chat.postMessage', payload, (err, response) ->
        if err
          console.error err
          dfd.reject err
        else
          dfd.resolve response
      dfd.promise

  Q.all promises
