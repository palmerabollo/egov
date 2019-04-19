from scraper_cat import scrape as scrape_cat
from scraper_dgt import scrape as scrape_dgt
from scraper_eus import scrape as scrape_eus

from utils import timeit


@timeit
def scrape():
    radars = []

    radars.extend(scrape_dgt())
    radars.extend(scrape_eus())
    radars.extend(scrape_cat())

    return radars