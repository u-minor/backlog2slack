import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
} from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';
import { App, MessageAttachment } from '@slack/bolt';
import { ChatPostMessageArguments } from '@slack/web-api';
import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { Backlog, Entity } from 'backlog-js';
import { backlogConst } from './backlogConst';
import { response } from './response';

interface SlackMember {
  email: string;
  name: string;
}

export const api = async (event: APIGatewayProxyEventV2) => {
  if (
    event.requestContext.http.path !== '/' ||
    event.requestContext.http.method !== 'POST'
  ) {
    return response(400, 'Invalid path or method');
  }

  const maybeBacklog = JSON.parse(event.body ?? '');
  if (!maybeBacklog || !maybeBacklog.id) {
    console.error('cannot parse body:', event.body);
    return response(400, 'Invalid body');
  }
  const backlog = maybeBacklog as Entity.Activity.Activity;

  console.log(`Start ${backlog.project.projectKey}-${backlog.content.key_id}`);
  if (backlog.notifications.length === 0) {
    console.log('Notification not found.');
    return response(200);
  }

  const [slackUsers, backlogUsers] = await Promise.all([
    fetchSlackUsers(),
    fetchBacklogUsers(backlog.project.projectKey),
  ]);

  const users: string[] = [];
  for (const notification of backlog.notifications as Entity.CommentNotification.CommentNotification[]) {
    // find backlog user
    const backlogUser = backlogUsers.find(
      (user) => user.id === notification.user.id,
    );
    if (!backlogUser) {
      continue;
    }
    // find slack user by slack user's email
    const slackUser = slackUsers.find(
      (user) => user.email === backlogUser.mailAddress,
    );
    if (!slackUser || !slackUser.name) {
      continue;
    }

    users.push(slackUser.name);
  }

  if (users.length === 0) {
    console.log('User not found.');
    return response(200);
  }

  const issue = await fetchBacklogIssue(
    backlog.project.projectKey,
    backlog.content.key_id,
  );

  console.log(`Start message post to ${users.join(',')}`);
  const message = generateChatMessage(backlog, issue);
  try {
    await postChatMessage(message, users);
    return response(200);
  } catch (err) {
    if (err instanceof Error) {
      console.log(err.message);
      return response(500, err.message);
    } else {
      return response(500);
    }
  }
};

const fetchBacklogIssue = (
  projectKey: string,
  issueKey: string,
): Promise<Entity.Issue.Issue> => {
  const backlog = new Backlog({
    host: process.env.BACKLOG_HOST ?? '',
    apiKey: process.env.BACKLOG_API_KEY ?? '',
  });

  return backlog.getIssue(`${projectKey}-${issueKey}`);
};

const fetchBacklogUsers = (projectKey: string) => {
  const backlog = new Backlog({
    host: process.env.BACKLOG_HOST ?? '',
    apiKey: process.env.BACKLOG_API_KEY ?? '',
  });

  return backlog.getProjectUsers(projectKey);
};

const fetchSlackUsers = async (): Promise<SlackMember[]> => {
  const client = new DynamoDBClient();

  try {
    const ret = await client.send(
      new GetItemCommand({
        TableName: process.env.DYNAMODB_TABLE_NAME ?? '',
        Key: marshall({ key: 'slackUsers' }),
      }),
    );
    if (ret.Item) {
      return JSON.parse(ret.Item.value.S ?? '[]');
    }
  } catch (err) {
    console.error('Error getting item from DynamoDB:', err);
    throw err;
  }

  const app = new App({
    token: process.env.SLACK_BOT_TOKEN,
    signingSecret: process.env.SLACK_SIGNING_SECRET,
  });
  const ret = await app.client.users.list();
  const members = (ret.members ?? [])
    .filter((member) => member.profile?.email && member.deleted !== true)
    .map((member) => ({
      email: member.profile?.email ?? '',
      name: member.name ?? '',
    }));

  try {
    await client.send(
      new PutItemCommand({
        TableName: process.env.DYNAMODB_TABLE_NAME ?? '',
        Item: marshall({
          key: 'slackUsers',
          value: JSON.stringify(members),
          ttl:
            Math.floor(Date.now() / 1000) +
            parseInt(process.env.CACHE_TTL ?? '300'),
        }),
      }),
    );
  } catch (err) {
    console.error('Error putting item to DynamoDB:', err);
    throw err;
  }

  return members;
};

const generateChatMessage = (
  backlogMessage: Entity.Activity.Activity,
  backlogIssue: Entity.Issue.Issue,
): ChatPostMessageArguments => {
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
    attachments: [
      {
        fallback: `Backlog - ${
          backlogConst.types[backlogMessage.type]
        }: ${backlogKey} ${backlogMessage.content.summary}`,
        color: backlogConst.statusColors[backlogIssue.status.id],
        pretext: `Backlog - ${backlogConst.types[backlogMessage.type]}`,
        text: `【${backlogIssue.issueType.name}】<https://${process.env.BACKLOG_HOST}/view/${backlogKey}|${backlogKey}> ${backlogMessage.content.summary}`,
        mrkdwn_in: ['pretext', 'text', 'fields'],
        fields,
      },
    ],
    channel: '',
  };
};

const postChatMessage = (
  message: ChatPostMessageArguments,
  users: string[],
) => {
  const app = new App({
    token: process.env.SLACK_BOT_TOKEN,
    signingSecret: process.env.SLACK_SIGNING_SECRET,
  });
  const promises: Promise<unknown>[] = [];
  for (const user of users) {
    const payload: ChatPostMessageArguments = {
      ...message,
      channel: `@${user}`,
    };
    console.log(payload);
    promises.push(app.client.chat.postMessage(payload));
  }
  return Promise.all(promises);
};
