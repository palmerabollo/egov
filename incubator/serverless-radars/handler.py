from scraper import scrape


def adapt(event, context):
    body = scrape()

    # TODO handle scraping errors

    return {
        "statusCode": 200,
        "body": body
    }
