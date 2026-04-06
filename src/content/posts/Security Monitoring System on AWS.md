---
title: "Part I & II: Building a Security Monitoring System on AWS"
published: 2026-4-3T00:00:00-08:00
tags: [AWS, Cloud Security]
description: "Follow along as I build a robust security monitoring system using AWS."
category: Cybersecurity
image: /aws_security.jpg
draft: true
---

# Introduction
Welcome to Part I & II of the AWS Security Monitoring System project! This project demonstrates building a comprehensive security monitoring system on AWS through a progressive, hands-on approach.

**Part I** establishes the foundational monitoring stack using AWS CloudTrail, CloudWatch, and SNS via the AWS Management Console and CLI. This manual setup is guided by [NextWork's walkthrough](https://learn.nextwork.org/projects/aws-security-monitoring?track=high). It's designed to provide an introduction into how these services integrate to detect and alert on unauthorized secret access.

![part 1 architecture](/partIarchitecture.png)

**Part II** extends this foundation with advanced security capabilities: GuardDuty for threat detection, automated remediation with Lambda and EventBridge, multi-account monitoring, and secret rotation. Critically, Part Two reimplements the entire architecture using Infrastructure-as-Code (Terraform and CloudFormation), transforming manual operations into reusable, version-controlled modules deployable across environments and AWS accounts.
The progression from hands-on to automated reflects how production security operations scale: understand the mechanics first, then codify them for repeatability, consistency, and governance.

**Part III** wil deal with more extensions, security testing, and compliance. I'll walk through each of the AWS CIS benchmarks, hardening our system and getting it prepared production.

I hope you enjoy this project as much as I did creating it! Feel free to use these resources for your own learning. Happy building!

---

# Part I
As stated in overview, Part I consists of the basics. We're just setting up the foundation in this section, and getting our feet wet with AWS services.

So, without further ado, let's get started! 🚀

## 1. Create a Secret
![step1](/architecture-1.png)

**Goal**:
- Create a new Secrets Manager secret.

Simple enough. All I did was create a basic secret without any key rotation scheduling or encryption - we'll set that up in Part II.

![Secret](/secret1.png)

## 2. Configure CloudTrail
![step2](/architecture-2.png)

**Goal**:
- Create a new CloudTrail trail to record your account's activity.
- Configure the trail to store logs in an S3 bucket.

I created a new Trail called `nextwork-secrets-manager-trail`. We're going to send the logs to an S3 bucket.

Also, I turned off Log file SSE-KMS encryption. Since this isn't a production architecture, I'll untick the boxes that just incur extra charges. The goal of this project is to learn how to architect without having to pay too much. :)

![cloudtrail1](/cloudtrail1.png)

Our trail is only set to track **management events**. Management events show admin actions that configure AWS resources. In our case, we're tracking secret accesses. 

The reason why retreiving a secret is a management event and not a **data event** is because retreiving a secret value is something that happens in the control plane. We're using a management action to decrypt and access protected configuration information. The secret itself is considered a configuration resource for your applications.

Now that we've set the trail up to track management events, we can move on to step 3.

## 3. Generate Secret Access Events
After selecting `Retrieve secret value` in the under our secret details page (or accessing it via the CLI), we can go back to CloudTrail to view what it logged.

![cloudtrail2](/cloudtrail2.png)

## 4. Track Secrets Access Using CloudWatch Metrics
We've configured CloudTrail tracking, now it's time to set up alerting.

**Goal**:
- Enable CloudWatch Logs for your CloudTrail trail.
- Define a CloudWatch Metric to track secret access.

Let's edit the Trail to enable `CloudWatch logs`. 

![cloudtrail3](/cloudtrail3.png)

The log group represents a collection of logs from a specific application or service. In this case, we're creating a new log group to store CloudTrail logs that came from our CloudTrail trail.

We also assigned it its own IAM role called `CloudTrailRoleForCloudWatchLogs_secrets-manager-trail`.

Why did we give it its own role? because we don't want to give CloudTrail unlimited access to write anywhere it wants. We gave it a role that specifically allows it to write logs to CloudWatch Logs, and nothing else. This follows the principle of **least privilege**. 

Navigating to CloudWatch, we can verify that our logs are being ingested.

![cloudwatch](/cloudtrail4.png)

Once we've verified that our logs are being ingested, we can start creating the alert. The difference between CloudTrail and CloudWatch is that CloudWatch is where we can set up alerts and automated responses when specific events happen. Additionally:

- CloudTrail Event History only keeps for 90 days, while CloudWatch logs can be stored for as long as you'd like.
- CloudWatch logs have powerful filtering tools that let us focus on exactly the events we care about.

Now, back to creating the alert.

- We'll set the `filter pattern` to `"GetSecretValue"`.
- Filter name to `GetSecretValue`
- Metric name to `Secret is accessed`
- Metric namespace to `SecurityMetrics`
    - Metric namespaces are great for grouping similar metrics together. In this case, the `SecurityMetrics` namesapce will group all our security-related metrics together.
- Our metric value set to `1` and our default value set to `0`.
    - Metrics values get recoreded when the filter hits a match in the logs. When set to `1`, the counter increases exactly. We set the default value to `0` to when there are no secret accesses, we just get a 0 rather than no info at all. It gives us a more complete picture.

![cloudwatch](/cloudwatch.png)

## 5. Create CloudWatch Alarm and SNS Topic

![step5](/architecture-5.png)

Amazon Simple Notification Service (SNS) is AWS's built-in messaging system. It lets AWS resources send notifications to people (via email, SMS, or mobile push) or even to other applications.

**Goal**:
- Create a CloudWatch Alarm based on the SecretIsAccessed metric.
- Create an SNS topic to send email notifications.
- Subscribe your email address to the SNS topic.


![Metric filters tab under CloudWatch](/metric-filters.png)

If you select your filter, you can **create an alarm**.

![Alarm creation page](/alarms.png)

Next:

![Configuring the alarm](/configuring-actions.png)

Once we've accepted the confirmation email to join the alarm, we can move to the next step and text to see if our email notification systems works as expected.

## 6. Test Email Notification

**Goal**:
- Retrieve your secret value again to trigger the alarm.
- Troubleshoot your monitoring system - why aren't you getting notified?

![step6](/architecture-6.png)

After navigating to Secrets Manager and revealing the secret, it looks like we haven't received an email. And we never will. It's time for troubleshooting! There are several places we should investigate as there are multiple points of failure:

1. CloudTrail didn't record the `GetSecretsValue` event
2. CloudTrail isn't sending logs to CloudWatch
3. CloudWatch's **metric filter** isn't filtering logs correctly.
4. CloudWatch's  Alarm isn't triggering an action.
5. SNS isn't delivering emails

First things first: check if CloudTrail actually recorded the event.

![Debugging Cloudtrail](/debug1.png)

It looks like CloudTrail is successfully logging events from Secrets Manager.

Second, check if CloudTrail is sending logs to CloudWatch.

![Debugging CloudWatch](/debug2.png)

No issues here. We can see that CloudWatch is ingesting logs just fine.

Third, determine if our `GetSecretsValue` metric filter isn't filtering logs correctly. We can do this by feeding the metric filter some test logs. For example:

```json
{"Records":[
{"eventVersion":"1.11","userIdentity":{"type":"IAMUser","principalId":"AIDAXXXXXXXXXXXXXXXX","arn":"arn:aws:iam::00000000000:user/IAM-Admin","accountId":"00000000000","accessKeyId":"ASIAXXXXXXXXXXXXXXXX","userName":"IAM-Admin","sessionContext":{"attributes":{"creationDate":"2025-03-19T09:17:54Z","mfaAuthenticated":"false"}}},"eventTime":"2025-03-19T18:44:29Z","eventSource":"secretsmanager.amazonaws.com","eventName":"GetSecretValue","awsRegion":"us-west-2","sourceIPAddress":"000.00.00.00","userAgent":"Some user agent info here","requestParameters":{"secretId":"arn:aws:secretsmanager:us-west-2:00000000000:secret:TopSecretInfo-lvRO68"},"responseElements":null,"requestID":"1471f5f6-aee8-4c56-92c8-eadd8ea4b3a2","eventID":"06e83132-44aa-412c-8e1d-da427a6dc6b1","readOnly":true,"eventType":"AwsApiCall","managementEvent":true,"recipientAccountId":"00000000000","eventCategory":"Management","tlsDetails":{"tlsVersion":"TLSv1.3","cipherSuite":"TLS_AES_128_GCM_SHA256","clientProvidedHostHeader":"secretsmanager.us-west-2.amazonaws.com"},"sessionCredentialFromConsole":"true"},
{"eventVersion":"1.11","userIdentity":{"type":"IAMUser","principalId":"AIDAXXXXXXXXXXXXXXXX","arn":"arn:aws:iam::00000000000:user/IAM-Admin","accountId":"00000000000","accessKeyId":"ASIAXXXXXXXXXXXXXXXX","userName":"IAM-Admin","sessionContext":{"attributes":{"creationDate":"2025-03-19T09:17:54Z","mfaAuthenticated":"false"}}},"eventTime":"2025-03-19T18:44:27Z","eventSource":"secretsmanager.amazonaws.com","eventName":"GetResourcePolicy","awsRegion":"us-west-2","sourceIPAddress":"000.00.00.00","userAgent":"Some user agent info here","requestParameters":{"secretId":"arn:aws:secretsmanager:us-west-2:00000000000:secret:TopSecretInfo-lvRO68"},"responseElements":null,"requestID":"6ca2b8cb-1da9-4f0b-8e2d-244aa0ef95d0","eventID":"88a52c53-19ce-4341-a49f-e08a07fc1c32","readOnly":true,"eventType":"AwsApiCall","managementEvent":true,"recipientAccountId":"00000000000","eventCategory":"Management","tlsDetails":{"tlsVersion":"TLSv1.3","cipherSuite":"TLS_AES_128_GCM_SHA256","clientProvidedHostHeader":"secretsmanager.us-west-2.amazonaws.com"},"sessionCredentialFromConsole":"true"},
{"eventVersion":"1.11","userIdentity":{"type":"IAMUser","principalId":"AIDAXXXXXXXXXXXXXXXX","arn":"arn:aws:iam::00000000000:user/IAM-Admin","accountId":"00000000000","accessKeyId":"ASIAXXXXXXXXXXXXXXXX","userName":"IAM-Admin","sessionContext":{"attributes":{"creationDate":"2025-03-19T09:17:54Z","mfaAuthenticated":"false"}}},"eventTime":"2025-03-19T10:18:06Z","eventSource":"secretsmanager.amazonaws.com","eventName":"ListSecretVersionIds","awsRegion":"us-west-2","sourceIPAddress":"000.00.00.00","userAgent":"Some user agent info here","requestParameters":{"secretId":"arn:aws:secretsmanager:us-west-2:00000000000:secret:TopSecretInfo-lvRO68","maxResults":100},"responseElements":null,"requestID":"9541d6b3-10c7-4356-aedf-9da4a0bebb67","eventID":"ac01a292-7781-408c-a04c-c41e9dfb241f","readOnly":true,"eventType":"AwsApiCall","managementEvent":true,"recipientAccountId":"00000000000","eventCategory":"Management","tlsDetails":{"tlsVersion":"TLSv1.3","cipherSuite":"TLS_AES_128_GCM_SHA256","clientProvidedHostHeader":"secretsmanager.us-west-2.amazonaws.com"},"sessionCredentialFromConsole":"true"}
...
```
With these example logs, we get some hits. So it isn't our metrics filter.


Fourth, review the CloudWatch alarm we created to investigate why the alarm isn't triggering an action. CloudWatch alarms have lots of components in them, so we have to be methodical. Looking at the metric and conditions overview, we get lots of important information.

If you remember, we set the `statistic` field to **Average**. This is off, since we don't care about the average amount of times we get the alert match, we care more about the sum of times the event happened. In other words, we don't want a rate - we want the sum of all occurences of secret access.

Lastly, we can double check that SNS is able to send emails.


As it turns out, we can manually set the alarm to the `ALARM` state. I used this command:

```bash
aws cloudwatch set-alarm-state \
    --alarm-name "Secret is accessed!" \
    --state-value ALARM \
    --state-reason "Manually triggered for testing"
```

You'll have to trust me on this, but I _did_ receive an email, so our alarm _can_ trigger an email.


Our investigation leads me to believe that the alarm settings in CloudWatch were the only thing that was off. Let's head back to the Secrets Manager now that we've fixed the issues.

![Success!](/success!.png)

And voila! We received the email, and our alarm successfully went off.

# Summary
So what did we do? In this introductory project, I learned how to:

- Securely store and manage secrets using AWS Secrets Manager. 🔑
- Monitor secret access by enabling AWS CloudTrail logging. 📜
- Investigate security events in CloudTrail Event History and S3 logs. 🔎
- Create CloudWatch Metric Filters to track secret access events. 📈
- Set up CloudWatch Alarms and SNS notifications for real-time security alerts. 🔔
- plus a little debugging!

In Part II, I'll build upon this foundation and start getting _real_ creative with AWS. That is, no more hand-holding! From this point on, all of this will be original work, with troubleshooting, bad practice, and lots of failing. 

![Finished product](/architecture-complete.png)

<div align="center">
    <small> Finished product. </small>
</div>

# Part II
Part II is where things start to get a bit more interesting. 