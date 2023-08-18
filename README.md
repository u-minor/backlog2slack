# backlog2slack

![image](image.jpg)

バックログの通知を Slack の Direct Message で受け取ります。
チケットの通知先に指定されているユーザーに DM で届くので、自分と関係ないタスクに煩わされることがありません。

> 通知対象となっている Backlog ユーザーのメールアドレスと Slack ユーザーのメールアドレスを照合して DM 先を抽出しているため、双方のツールで同じメールアドレスを設定してください。

Amazon API Gateway + AWS Lambda で動作するため、ほとんどのケースにおいてコストゼロで運用できます。

## 必要なもの

- node 16.x + npm 8.x
- aws-cli (Web の Management Console で設定する場合は不要)
- Backlog API Key
- Slack API Token

## Setup

### パッケージの準備

#### NPM Package のインストール

```command-line
npm install
```

#### Lambda zip パッケージの作成

```command-line
npm run build
```

#### Lambda zip, stack template を S3 にアップロード

> aws-cli を利用していますが、Management Console を用いてアップロードしてもOKです。

```command-line
aws s3 cp dist/lambda.zip s3://bucket/path/to/lambda.zip
aws s3 cp cf/stack.yml s3://bucket/path/to/stack.yml
```

### CloudFormation Stack の構築

> aws-cli を利用していますが、Management Console を用いて構築しても OK です。

#### cf/params.json の作成

cf/params.json.example を複製し、適切な値をセットしてください。

- BacklogAPIKey: Backlog の API キーです。Backlog の「個人設定 - API」で API キーを発行してください。
- BacklogBaseUrl: API アクセス用のベースURLです。 `https://[スペース名].backlog.jp` になります。
- LambdaS3Bucket: lambda.zip を設置した S3 bucket 名です。
- LambdaS3Path: LambdaS3Bucket で設定した bucket 内での lambda.zip のパスです。（先頭の / は不要です）
- SlackAPIToken: Slack の API Token です。アプリを新規に作成するか、Hubot 等の適当なアプリの API Token を利用してください。

#### Stack の作成

作成した cf/params.json を指定して、stack を構築します。stack name は適宜変更してください。

```command-line
aws cloudformation create-stack \
  --stack-name backlog2slack \
  --capabilities CAPABILITY_IAM \
  --parameters file://cf/params.json \
  --template-url https://bucket.s3-ap-northeast-1.amazonaws.com/path/to/stack.yml
```

> 内部で Lambda 用の IAM Role を生成するため、実行アカウントに iam:CreateRole 権限が必要です。

### Backlog 側の設定

```command-line
aws cloudformation describe-stacks \
  --stack-name backlog2slack \
  --output text \
  --query 'Stacks[].Outputs[?OutputKey==`RestAPIBase`].OutputValue'
```

上記コマンドで取得した API Gateway のベース URL に `/notify` を付加したものを Backlog の Webhook に登録してください。

## Lambda function 単体の更新方法

Lambda コードを修正した場合は、S3 に Lambda コードをアップロードした上で、以下のように update-function-code を実行してください。

> Lambda の function name は stack name から自動取得しています。

```command-line
aws s3 cp dist/lambda.zip s3://bucket/path/to/lambda.zip

aws lambda update-function-code \
  --function-name $(aws cloudformation describe-stack-resources \
    --stack-name backlog2slack \
    --output text \
    --query 'StackResources[?ResourceType==`AWS::Lambda::Function`].PhysicalResourceId') \
  --s3-bucket bucket \
  --s3-key path/to/lambda.zip
```
