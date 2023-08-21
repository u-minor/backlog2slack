import { APIGatewayProxyEvent, Callback, Context } from 'aws-lambda';
import _ from 'lodash';
import Slack from 'slack-node';
import backlogConst from './backlogConst';
import response from './response';
import { Entity } from 'backlog-js';

interface SlackUsersList {
  ok: boolean;
  members: SlackUser[];
  cache_ts: number;
  response_metadata: {
    next_cursor: string;
  };
}

interface SlackUser {
  name: string;
  profile: {
    email: string;
  };
}

interface SlackField {
  short?: boolean;
  title?: string;
  value?: string;
}

const slack = new Slack(process.env.SLACK_API_TOKEN);

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
      slackUsers.members,
      (o) => o.profile.email === backlogUser.mailAddress,
    );
    if (!slackUser) {
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

const fetchSlackUsers = (): Promise<SlackUsersList> =>
  new Promise((resolve, reject) => {
    slack.api('users.list', (err, response) => {
      if (err) {
        console.error(err);
        reject(err);
      } else {
        resolve(response);
      }
    });
  });

const generateChatMessage = (
  backlogMessage: Entity.Activity.Activity,
  backlogIssue: Entity.Issue.Issue,
) => {
  const backlogKey = `${backlogMessage.project.projectKey}-${backlogMessage.content.key_id}`;
  const fields: SlackField[] = [
    {
      value: `*状態*: ${backlogIssue.status.name}`,
      short: true,
    },
    {
      value: `*優先度*: ${backlogIssue.priority.name}`,
      short: true,
    },
  ];

  if (backlogIssue.assignee) {
    fields.push({
      value: `*担当者*: ${backlogIssue.assignee.name}`,
      short: true,
    });
  }

  if (backlogIssue.updatedUser) {
    fields.push({
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
  const promises: Promise<unknown>[] = [];
  for (const user of users) {
    const payload = _.extend({}, message, { channel: `@${user}` });
    console.log(payload);
    promises.push(
      new Promise((resolve, reject) => {
        slack.api('chat.postMessage', payload, (err, response) => {
          if (err) {
            console.error(err);
            reject(err);
          } else {
            resolve(response);
          }
        });
      }),
    );
  }
  return Promise.all(promises);
};
