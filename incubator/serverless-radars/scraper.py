import requests
import json
import bs4
import camelot
from urllib.parse import urljoin


BASE_URL = "http://www.dgt.es/es/el-trafico/control-de-velocidad/"
TEXT_LINK_DOWNLOAD = "aquí"


def find_pdf_url(base_url, text_pdf):
    # XXX decide whether we want to pretend we are a regular browser or not
    headers={
        "Host": "www.dgt.es",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.14; rv:66.0) Gecko/20100101 Firefox/66.0",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "es",
        "Accept-Encoding": "gzip, deflate",
        "Cookie": "idioma=es_ES",
        "Cache-Control": "max-age=0"
    }

    req = requests.get(base_url, headers)

    if req.ok:
        dgt_html = bs4.BeautifulSoup(req.text, features="html.parser")

        links = dgt_html.find_all("a", href=True)

        pdf = [_ for _ in links if text_pdf in _.text]

        pdf_relative_url = pdf[0].get("href")
        pdf_url = urljoin(base_url, pdf_relative_url)

        return pdf_url
    else:
        print("Error trying to get {}".format(base_url))
        req.raise_for_status()


def scrape():
    pdf_url = find_pdf_url(BASE_URL, TEXT_LINK_DOWNLOAD)

    tables = camelot.read_pdf(pdf_url, pages="all")
    if len(tables) == 0:
        # XXX use proper exception
        raise Exception("No data found in the source document")

    print(tables[0].df)
    print(tables[0].df.to_json(orient='records'))

    # TODO convert the dataframe to the following format
    #[
    #    {
    #      "provincia": "Albacete",
    #      "carretera": "A-30",
    #      "tipo": "Fijo",
    #      "PK": 49.234
    #      "Sentido": "Creciente",
    #      "Fecha": "2019-04-05"
    #    },
    #    ...
    #    ]

    # Experiments
    # tables.export('foo.json', f='json')
    # print(tables[0].parsing_report)
    # tables[0].to_json('foo.json')

    radars = []

    return radars
