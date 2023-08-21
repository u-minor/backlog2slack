import { App, MessageAttachment } from '@slack/bolt';
import { APIGatewayProxyEvent, Callback, Context } from 'aws-lambda';
import { Entity } from 'backlog-js';
import _ from 'lodash';
import backlogConst from './backlogConst';
import response from './response';

export default async (
  event: APIGatewayProxyEvent,
  context: Context,
  callback: Callback,
) => {
  if (event.path !== '/notify' || event.httpMethod !== 'POST') {
    return callback(null, response(400));
  }

  const maybeBacklog = JSON.parse(event.body ?? '');
  if (!maybeBacklog || !maybeBacklog.id) {
    console.error('cannot parse body:', event.body);
    return callback(null, response(400));
  }
  const backlog = maybeBacklog as Entity.Activity.Activity;

  console.log(`Start ${backlog.project.projectKey}-${backlog.content.key_id}`);
  if (backlog.notifications.length === 0) {
    console.log('Notification not found.');
    return callback(null, response(200, 'OK'));
  }

  const [slackUsers, backlogUsers] = await Promise.all([
    fetchSlackUsers(),
    fetchBacklogUsers(backlog.project.projectKey),
  ]);

  const users: string[] = [];
  for (const notification of backlog.notifications as Entity.CommentNotification.CommentNotification[]) {
    // find backlog user
    const backlogUser = _.find(backlogUsers, { id: notification.user.id });
    if (!backlogUser) {
      continue;
    }
    // find slack user by slack user's email
    const slackUser = _.find(
      slackUsers,
      (o) => o.profile?.email === backlogUser.mailAddress,
    );
    if (!slackUser || !slackUser.name) {
      continue;
    }

    users.push(slackUser.name);
  }

  if (users.length === 0) {
    console.log('User not found.');
    return callback(null, response(200, 'OK'));
  }

  const issue = await fetchBacklogIssue(
    backlog.project.projectKey,
    backlog.content.key_id,
  );

  console.log(`Start message post to ${users.join(',')}`);
  const message = generateChatMessage(backlog, issue);
  try {
    await postChatMessage(message, users);
    callback(null, response(200, 'OK'));
  } catch (err) {
    if (err instanceof Error) {
      callback(null, response(500, err.message));
    } else {
      callback(null, response(500, 'Unknown error'));
    }
  }
};

const fetchBacklogIssue = (
  projectKey: string,
  issueKey: string,
): Promise<Entity.Issue.Issue> =>
  fetch(
    `${process.env.BACKLOG_BASE_URL}/api/v2/issues/${projectKey}-${issueKey}?` +
      new URLSearchParams({ apiKey: process.env.BACKLOG_API_KEY ?? '' }),
  ).then((res) => res.json() as Promise<Entity.Issue.Issue>);

const fetchBacklogUsers = (projectKey: string) =>
  fetch(
    `${process.env.BACKLOG_BASE_URL}/api/v2/projects/${projectKey}/users?` +
      new URLSearchParams({ apiKey: process.env.BACKLOG_API_KEY ?? '' }),
  ).then((res) => res.json() as Promise<Entity.User.User[]>);

const fetchSlackUsers = async () => {
  const app = new App({
    token: process.env.SLACK_BOT_TOKEN,
    signingSecret: process.env.SLACK_SIGNING_SECRET,
  });
  const ret = await app.client.users.list();
  return ret.members ?? [];
};

const generateChatMessage = (
  backlogMessage: Entity.Activity.Activity,
  backlogIssue: Entity.Issue.Issue,
) => {
  const backlogKey = `${backlogMessage.project.projectKey}-${backlogMessage.content.key_id}`;
  const fields: MessageAttachment['fields'] = [
    {
      title: '',
      value: `*状態*: ${backlogIssue.status.name}`,
      short: true,
    },
    {
      title: '',
      value: `*優先度*: ${backlogIssue.priority.name}`,
      short: true,
    },
  ];

  if (backlogIssue.assignee) {
    fields.push({
      title: '',
      value: `*担当者*: ${backlogIssue.assignee.name}`,
      short: true,
    });
  }

  if (backlogIssue.updatedUser) {
    fields.push({
      title: '',
      value: `*更新者*: ${backlogIssue.updatedUser.name}`,
      short: true,
    });
  }

  if (backlogMessage.content.comment) {
    fields.push({
      title: 'コメント',
      value: backlogMessage.content.comment.content.replace('\n', ' '),
      short: false,
    });
  }

  return {
    as_user: true,
    attachments: JSON.stringify([
      {
        fallback: `Backlog - ${
          backlogConst.types[backlogMessage.type]
        }: ${backlogKey} ${backlogMessage.content.summary}`,
        color: backlogConst.statusColors[backlogIssue.status.id],
        pretext: `Backlog - ${backlogConst.types[backlogMessage.type]}`,
        text: `【${backlogIssue.issueType.name}】<${process.env.BACKLOG_BASE_URL}/view/${backlogKey}|${backlogKey}> ${backlogMessage.content.summary}`,
        mrkdwn_in: ['pretext', 'text', 'fields'],
        fields,
      },
    ]),
  };
};

const postChatMessage = (message: unknown, users: string[]) => {
  const app = new App({
    token: process.env.SLACK_BOT_TOKEN,
    signingSecret: process.env.SLACK_SIGNING_SECRET,
  });
  const promises: Promise<unknown>[] = [];
  for (const user of users) {
    const payload = _.extend({}, message, { channel: `@${user}` });
    console.log(payload);
    promises.push(app.client.chat.postMessage(payload));
  }
  return Promise.all(promises);
};