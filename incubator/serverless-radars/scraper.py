import requests
import json
import bs4
import time
from multiprocessing import Process, Pipe
import camelot
import camelot.utils as utils
from urllib.parse import urljoin
from datetime import datetime
from PyPDF2 import PdfFileReader

BASE_URL = "http://www.dgt.es/es/el-trafico/control-de-velocidad/"
TEXT_LINK_DOWNLOAD = "aquí"


def find_pdf_url():
    # XXX decide whether we want to pretend we are a regular browser or not, move to a shared lib maybe
    headers = {
        "Host": "www.dgt.es",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.14; rv:66.0) Gecko/20100101 Firefox/66.0",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "es",
        "Accept-Encoding": "gzip, deflate",
        "Cookie": "idioma=es_ES",
        "Cache-Control": "max-age=0"
    }

    req = requests.get(BASE_URL, headers)

    if req.ok:
        dgt_html = bs4.BeautifulSoup(req.text, features="html.parser")

        links = dgt_html.find_all("a", href=True)

        pdf = [_ for _ in links if TEXT_LINK_DOWNLOAD in _.text]

        pdf_relative_url = pdf[0].get("href")
        pdf_url = urljoin(BASE_URL, pdf_relative_url)

        return pdf_url
    else:
        print("Error trying to get {}".format(BASE_URL))
        req.raise_for_status()


def pdf_to_table(file_path, start, end, conn):
    """
    Parses the rows in a set of PDF pages
    """
    tables = camelot.read_pdf(file_path, pages="{}-{}".format(start, end))

    if end != 'end' and len(tables) != (end - start + 1):
        raise Exception("No valid data found in the source document")

    print("process pdf pages {} to {}".format(start, end))
    radars = tables_to_radars(tables)
    print("{} radars found".format(len(radars)))
    conn.send(radars)


def tables_to_radars(tables):
    radars = []

    for index_table, table in enumerate(tables):
        for index_row, row in table.df.iterrows():
            if index_table == 0 and index_row == 0:  # skip header
               continue

            sense = map_sense(row.values[4])
            radar = {
                "adminName2": row.values[0],  # adminName2 is the same term used by geonames
                "roadName": row.values[1],
                "type": map_type(row.values[2]),
                "sense": sense,
                "locations": [],
                "updated_at": convert_date(row.values[5])
            }

            if sense is "BOTH":
                kms = row.values[3].split(" - ")  # XXX this split is a bit fragile
                radar["locations"].append(float(kms[0]))
                radar["locations"].append(float(kms[1]))
            else:
                radar["locations"].append(float(row.values[3]))

            radars.append(radar)

    return radars


def scrape():
    _t = time.time()
    pdf_url = find_pdf_url()
    file_path = utils.download_url(pdf_url)
    print("Elapsed time {}".format(time.time() - _t))

    infile = PdfFileReader(file_path, strict=False)
    pages = infile.getNumPages()

    # Parsing the PDF can take some time (around 1 min)
    # We use multiprocessing to overcome the 30-sec timeout in API Gateway !!
    # see examples https://aws.amazon.com/blogs/compute/parallel-processing-in-python-with-aws-lambda/
    # Notice that multiprocessing.Queue does not work in AWS lambda

    pages_per_process = 2
    procs = []
    parent_conns = []
    for page in range(1, pages, pages_per_process):
        parent_conn, child_conn = Pipe()
        parent_conns.append(parent_conn)

        start = page
        end = page + pages_per_process - 1 if page + pages_per_process - 1 < pages else 'end'
        p = Process(target=pdf_to_table, args=(file_path, start, end, child_conn))
        procs.append(p)
        p.start()


    radars = []

    for parent_connection in parent_conns:
        radars.extend(parent_connection.recv())

    for p in procs:
        p.join()

    print("Elapsed time {}".format(time.time() - _t))

    return radars


TYPES={
    "Radar Fijo": "FIXED",
    "Radar Móvil": "MOVING",
    "Radar Tramo": "STRETCH"
}

SENSES={
    "Creciente": "INCREASING",
    "Decreciente": "DECREASING",
    "Ambos": "BOTH"
}


def map_type(raw_value):
    return TYPES.get(raw_value, "UNKNOWN")


def map_sense(raw_value):
    return SENSES.get(raw_value, "UNKNOWN")


def convert_date(raw_value):
    return datetime.strptime(raw_value, '%d/%m/%Y').isoformat()
