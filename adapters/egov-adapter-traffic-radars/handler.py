from scraper import scrape
from cloud import upload, temporal_url


# see https://www.npmjs.com/package/serverless-python-requirements#dealing-with-lambdas-size-limitations
try:
  import unzip_requirements
except ImportError:
  pass


def scheduled_scrape(event, context):
    data = scrape()
    upload(data)


def adapt(event, context):
    url = temporal_url()

    if url:
        return {
            "statusCode": 302,
            "headers": {
                "Location": url
            }
        }
    else:
        return {
            "statusCode": 404
        }
