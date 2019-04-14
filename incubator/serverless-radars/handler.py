import json
from scraper import scrape

def adapt(event, context):
    result = scrape()

    # TODO handle scraping errors

    response = {
        "statusCode": 200,
        "body": result
    }

    return response