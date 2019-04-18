import boto3
import json
import os
from datetime import datetime, timedelta

client = boto3.client("s3")

BUCKET = os.environ["BUCKET"]
REGION = os.environ["REGION"]
FILE_NAME = "data.json"

def upload(data):
    try:
        client.create_bucket(
            Bucket=BUCKET,
            CreateBucketConfiguration={ "LocationConstraint": REGION })
    except client.exceptions.BucketAlreadyOwnedByYou:
        pass

    client.put_object(
        Bucket=BUCKET,
        Key=FILE_NAME,
        Body=json.dumps(data),
        Expires=datetime.utcnow() + timedelta(days=15))  # serve fresh data only


def temporal_url():
    if not object_exists(FILE_NAME):
        return None

    url = client.generate_presigned_url(
        ClientMethod="get_object",
        Params={
            "Bucket": BUCKET,
            "Key": FILE_NAME
        },
        ExpiresIn=300
    )
    return url


def object_exists(path):
    try:
        boto3.resource('s3').Object(BUCKET, path).load()  # load = HEAD request
    except client.exceptions.ClientError as e:
        if e.response['Error']['Code'] == "404":
            return False
        else:
            raise

    return True
