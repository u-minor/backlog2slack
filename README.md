# aglex-backlog-slack

バックログの通知を Slack DM で受け取るための API です。

Amazon API Gateway + AWS Lambda + Express で動作するため、ほとんどのケースにおいてコストゼロで運用できます。

> [API Gateway + Lambda を使って Backlog 通知を Slack で受け取る](http://qiita.com/u-minor/items/57e68dd183925b3e6897)

## 必要なもの

- node 4系 以上 + gulp
- aws-cli (Web の Management Console で設定する場合は不要)
- Backlog API Key
- Slack API Token

## Configure

### AWS 周りの準備

#### IAM Role の作成

Lambda を稼働させるための IAM Role を作成します。

```
aws iam create-role \
  --role-name lambda-backlog-slack \
  --assume-role-policy-document file://extra/AssumeRolePolicy.json
```

#### IAM Role へのポリシー割当て

作成した Role に AWSLambdaExecute ポリシーをアタッチします。

```
aws iam attach-role-policy \
  --role-name lambda-backlog-slack \
  --policy-arn arn:aws:iam::aws:policy/AWSLambdaExecute
```

### aglex の設定

[aglex](https://www.npmjs.com/package/aglex) 用の設定ファイルを作成します。

```
cp aglex.yml.example aglex-production.yml
```

AWS CLI のデフォルトの profile を使用していれば、特に変更は必要ありません。
profile を複数利用している場合は、YAML 内の `config.profile` を修正してください。

### Express App で利用する config の設定

```
cp config/environment.yml.example config/production.yml
```

Backlog の API Key や Base URL、Slack の API Token の設定を行います。

## Install

### NPM Package のインストール

```
npm install
```

> gulp を未インストールの場合は、 `npm i -g gulp-cli` してください。

### Lambda の登録

```
gulp updateLambda --env=production
```

### Lambda への権限割当て

```
gulp addLambdaPermission --env=production
```

### API Gateway の登録

```
gulp updateApi --env=production
```

### API Gateway のデプロイ

```
gulp deployApi --env=production --stage=prod
```

## Backlog の設定

stage 情報を以下のコマンドで取得

```
gulp listStages
```

Endpoint URL に `/[サービス名]/notify` を付加したものを Backlog の Webhook に登録してください。

> `[サービス名]` は config/production.yml で指定した `backlog.SERVICE1.apiKey` の `SERVICE1` に該当する部分です。
