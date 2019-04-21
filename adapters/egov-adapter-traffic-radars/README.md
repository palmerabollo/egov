# egov-adapter-traffic-radars

This is a proof of concept (PoC) to **write scrapers for egov in different languages**. In this example we scrape data about traffic radars from the DGT ("Dirección General de Tráfico").

The idea is to write them as **serverless processes exposing a well-known HTTP interface**. We would call each of those processes an "adapter". Then, a data-provider (Node.js/TypeScript) just needs to call the adapter and cache the response if needed.

> data-provider --(http)--> adapter --(http scrape)--> datasource

Why serverless? Because it can help us save a lot of money and make the project sustainable from an economic perspective. This is particularly important in cases where we can cache the response because data doesn't change very often.

This PoC uses the [serverless framework](https://serverless.com/) to try to normalize the way we write and deploy the adapters. You can install it with `npm i -g serverless`.

## How to create an adapter

First we need to create the project using one of the templates provided by serverless framework. This is an example for python3:

```
serverless create \
    --template aws-python3 \
    --name adapter-dgt
```

It creates a `handler.py` file:

```python
from scraper import scrape

def adapt(event, context):
    body = scrape()

    return {
        "statusCode": 200,
        "body": body
    }
```

And also a deployment manifest (serverless.yml) that should look like this:

```yaml
service: egov-adapter-traffic-radars

provider:
  name: aws
  runtime: python3.7
  region: eu-west-1

functions:
  adapt:
    handler: handler.adapt
    events:
      - http:
          path: "{proxy+}"
          method: get

plugins:
  - serverless-python-requirements

custom:
  pythonRequirements:
    dockerizePip: non-linux
```

You only need "serverless-python-requirements" if you plan to use third-party python modules.
In the future, we can provide a template to make all this process even simpler.

## How to test an adapter

```
serverless invoke local --function adapt
```

## How to deploy an adapter

This deploys the adapter to AWS. It requires a user account on AWS. It is free up to 1M calls per month.

```
serverless deploy
```

# Restrictions found so far

## Max function size (50 MB)

With serverless, "Request must be smaller than 69905067 bytes for the UpdateFunctionCode operation".
This is a restriction in functions with many third-party dependencies. The serverless plugin "serverless-python-requirements" comes with some handy features to deal with it.

You can zip and upload it to S3. In this case the limit is 250MB.
Packages suck as numpy, pandas, etc are quite big and often hit this limit.

## API Gateway timeout (30 seconds)

The Amazon API Gateway imposes a timeout of 30 seconds.

This means that you need to gather the data, process it and send a HTTP response in less than 30 seconds.

In this example (DGB) I wasn't able to process the PDF file in less than 35 seconds so I ended up doing two functions:
1. The first function gathers the data, processes it and leaves the result in a file in a S3 bucket. It is scheduled to run in background, every few hours. This way we overcome the 30-seconds timeout.
2. The second function is exposed via API Gateway and just redirects the user to a temporal url to the file, in milliseconds.
