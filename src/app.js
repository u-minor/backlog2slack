'use strict'
const _ = require('lodash')
const Slack = require('slack-node')
const config = require('config')
const express = require('express')
const request = require('request-promise-native')

const slack = new Slack(config.slack.apiToken)
const app = express()
app.use(require('body-parser').json({limit: '5mb'}))

const types = {
  1: '課題の追加',
  2: '課題の更新',
  3: '課題にコメント',
  4: '課題の削除',
  5: 'Wikiを追加',
  6: 'Wikiを更新',
  7: 'Wikiを削除',
  8: '共有ファイルを追加',
  9: '共有ファイルを更新',
  10: '共有ファイルを削除',
  11: 'Subversionコミット',
  12: 'GITプッシュ',
  13: 'GITリポジトリ作成',
  14: '課題をまとめて更新',
  15: 'プロジェクトに参加',
  16: 'プロジェクトから脱退',
  17: 'コメントにお知らせを追加',
  18: 'プルリクエストの追加',
  19: 'プルリクエストの更新',
  20: 'プルリクエストにコメント'
}

const statusColors = {
  1: '#ED8077',
  2: '#4488C5',
  3: '#5EB5A6',
  4: '#B0BE3C'
}

app.use('/:service/notify', (req, res) => {
  const bl = req.body
  const blKey = `${bl.project.projectKey}-${bl.content.key_id}`

  console.log(`Start ${blKey}`)
  if (bl.notifications.length === 0) {
    console.log('Notification not found.')
    res.json({message: 'OK'})
    return
  }

  Promise.all([
    fetchSlackUsers(),
    fetchBacklogUsers(req.params.service, bl.project.projectKey),
    fetchBacklogIssue(req.params.service, `${bl.project.projectKey}-${bl.content.key_id}`)
  ]).then(data => {
    const users = []
    for (let notification of bl.notifications) {
      const blUser = _.find(data[1], {id: notification.user.id})
      if (!blUser) {
        continue
      }
      const slUser = _.find(data[0].members, o => o.profile.email === blUser.mailAddress)
      if (!slUser) {
        continue
      }

      users.push(slUser.name)
    }

    if (users.length === 0) {
      console.log('User not found.')
      res.json({message: 'OK'})
      return
    }

    console.log(`Start message post to ${users.join(',')}`)
    const message = generateChatMessage(req.params.service, bl, data[2])
    postChatMessage(message, users)
      .then(data => res.json({message: 'OK'}), err => res.status(404).json(err))
  })
})

app.use((req, res, next) =>
  res.status(404).json({error: 'Not Found'})
)

app.use((err, req, res) => {
  console.error(err.stack)
  res.status(500).json({error: 'Internal Server Error'})
})

module.exports = app

function fetchBacklogIssue (service, issueKey) {
  return request({
    uri: `${config.backlog[service].baseUrl}/api/v2/issues/${issueKey}`,
    qs: {
      apiKey: config.backlog[service].apiKey
    },
    json: true
  })
}

function fetchBacklogUsers (service, projectKey) {
  return request({
    uri: `${config.backlog[service].baseUrl}/api/v2/projects/${projectKey}/users`,
    qs: {
      apiKey: config.backlog[service].apiKey
    },
    json: true
  })
}

function fetchSlackUsers () {
  return new Promise((resolve, reject) => {
    slack.api('users.list', (err, response) => {
      if (err) {
        console.error(err)
        reject(err)
      } else {
        resolve(response)
      }
    })
  })
}

function generateChatMessage (service, backlogMessage, backlogIssue) {
  const blKey = `${backlogMessage.project.projectKey}-${backlogMessage.content.key_id}`
  const fields = []

  fields.push({
    value: `*状態*: ${backlogIssue.status.name}`,
    short: true
  })

  fields.push({
    value: `*優先度*: ${backlogIssue.priority.name}`,
    short: true
  })

  if (backlogIssue.assignee) {
    fields.push({
      value: `*担当者*: ${backlogIssue.assignee.name}`,
      short: true
    })
  }

  if (backlogIssue.updatedUser) {
    fields.push({
      value: `*更新者*: ${backlogIssue.updatedUser.name}`,
      short: true
    })
  }

  if (backlogMessage.content.comment) {
    fields.push({
      title: 'コメント',
      value: backlogMessage.content.comment.content.replace('\n', ' '),
      short: false
    })
  }
  return {
    as_user: true,
    attachments: JSON.stringify([
      {
        fallback: `Backlog - ${types[backlogMessage.type]}: ${blKey} ${backlogMessage.content.summary}`,
        color: statusColors[backlogIssue.status.id],
        pretext: `Backlog - ${types[backlogMessage.type]}`,
        text: `【${backlogIssue.issueType.name}】<${config.backlog[service].baseUrl}/view/${blKey}|${blKey}> ${backlogMessage.content.summary}`,
        mrkdwn_in: ['pretext', 'text', 'fields'],
        fields: fields
      }
    ])
  }
}

function postChatMessage (message, users) {
  const promises = []
  for (let user of users) {
    const payload = _.extend({}, message, {channel: `@${user}`})
    console.log(payload)
    promises.push(new Promise((resolve, reject) => {
      slack.api('chat.postMessage', payload, (err, response) => {
        if (err) {
          console.error(err)
          reject(err)
        } else {
          resolve(response)
        }
      })
    }))
  }
  return Promise.all(promises)
}
