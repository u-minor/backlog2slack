import { Fn, Stack } from 'aws-cdk-lib';
import { ICertificate } from 'aws-cdk-lib/aws-certificatemanager';
import {
  AllowedMethods,
  CachePolicy,
  Distribution,
  OriginProtocolPolicy,
  OriginRequestPolicy,
  OriginSslPolicy,
  PriceClass,
  ResponseHeadersPolicy,
  ViewerProtocolPolicy,
} from 'aws-cdk-lib/aws-cloudfront';
import { HttpOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';

export interface CloudFrontResourceProps {
  certificate: ICertificate;
  domainName: string;
  lambda: {
    functionUrl: string;
  };
}

export class CloudFrontResource {
  distribution: Distribution;

  constructor(stack: Stack, props: CloudFrontResourceProps) {
    this.distribution = new Distribution(stack, 'Distribution', {
      certificate: props.certificate,
      comment: 'Distribution for backlog2slack',
      domainNames: [props.domainName],
      defaultBehavior: {
        allowedMethods: AllowedMethods.ALLOW_ALL,
        cachePolicy: CachePolicy.CACHING_DISABLED,
        origin: new HttpOrigin(
          Fn.select(2, Fn.split('/', props.lambda.functionUrl)),
          {
            protocolPolicy: OriginProtocolPolicy.HTTPS_ONLY,
            originSslProtocols: [OriginSslPolicy.TLS_V1_2],
          },
        ),
        originRequestPolicy: OriginRequestPolicy.fromOriginRequestPolicyId(
          stack,
          'OriginRequestPolicy',
          '88a5eaf4-2fd4-4709-b370-b4c650ea3fcf',
        ), // https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/using-managed-origin-request-policies.html#managed-origin-request-policy-cors-s3
        responseHeadersPolicy:
          ResponseHeadersPolicy.fromResponseHeadersPolicyId(
            stack,
            'ResponseHeadersPolicy',
            '5cc3b908-e619-4b99-88e5-2cf7f45965bd',
          ), // https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/using-managed-response-headers-policies.html#managed-response-headers-policies-cors-preflight
        viewerProtocolPolicy: ViewerProtocolPolicy.HTTPS_ONLY,
      },
      priceClass: PriceClass.PRICE_CLASS_200,
    });
  }
}
